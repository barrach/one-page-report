import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@budget/components/ui/dialog";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
import {
  Trash2, Plus, FileSpreadsheet, ArrowDown, ArrowUp, Loader2,
  IndentIncrease, IndentDecrease, FolderTree,
} from "lucide-react";
import { ScrollArea } from "@budget/components/ui/scroll-area";

import { type CpuItemDraft, renumberItems } from "@budget/lib/cpuItemsBuilder";
import { formatBRL } from "@budget/lib/format";
import { supabase } from "@budget/integrations/supabase/client";
import { useToast } from "@budget/hooks/use-toast";
import { useCpuClientTemplates } from "@budget/hooks/useCpuClientTemplates";
import { cn } from "@budget/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialItems: CpuItemDraft[];
  projectId: string;
  scenarioId: string;
  projectName: string;
  proposalNumber?: string;
  budgetVersion: number;
  bdiServicePct: number;
  bdiMaterialPct: number;
}

const CpuExportDialog = ({
  open, onOpenChange, initialItems, projectId, scenarioId,
  projectName, proposalNumber, budgetVersion, bdiServicePct, bdiMaterialPct,
}: Props) => {
  const { toast } = useToast();
  const { data: templates = [] } = useCpuClientTemplates();
  const [items, setItems] = useState<CpuItemDraft[]>(initialItems);
  const [exporting, setExporting] = useState(false);
  const [templateId, setTemplateId] = useState<string>("megasteam");

  useEffect(() => {
    if (open) setItems(renumberItems(initialItems));
  }, [open, initialItems]);

  const updateItem = (id: string, patch: Partial<CpuItemDraft>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    // remove + qualquer filho que aponte pra ele
    setItems((prev) => renumberItems(prev.filter((it) => it.id !== id && it.parent_id !== id)));
  };

  const addItem = (classe: CpuItemDraft["classe"], asGroup = false) => {
    const newItem: CpuItemDraft = {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      numero: "",
      descricao: asGroup
        ? "Novo grupo"
        : classe === "mob" ? "Novo item" : classe === "material" ? "Novo material" : "Novo serviço",
      quantidade: asGroup ? 0 : 1,
      unidade: asGroup ? "" : classe === "material" ? "un" : "VB",
      custo_unitario: 0,
      classe,
      is_group: asGroup,
      parent_id: null,
    };
    setItems((prev) => renumberItems([...prev, newItem]));
  };

  const moveItem = (id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const targetIdx = idx + dir;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      if (prev[idx].classe !== prev[targetIdx].classe) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return renumberItems(next);
    });
  };

  // Indenta = define o item anterior (mesmo classe) como pai
  const indent = (id: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx <= 0) return prev;
      const it = prev[idx];
      // procura para trás o candidato a pai (mesma classe)
      for (let i = idx - 1; i >= 0; i--) {
        if (prev[i].classe === it.classe) {
          const next = [...prev];
          next[idx] = { ...it, parent_id: prev[i].id };
          return renumberItems(next);
        }
      }
      return prev;
    });
  };
  const outdent = (id: string) => {
    setItems((prev) => renumberItems(prev.map((it) => (it.id === id ? { ...it, parent_id: null } : it))));
  };

  const totals = useMemo(() => {
    let serv = 0, mat = 0;
    items.forEach((it) => {
      if (it.is_group) return;
      const bdi = it.classe === "material" ? bdiMaterialPct : bdiServicePct;
      const total = it.custo_unitario * (1 + bdi / 100) * it.quantidade;
      if (it.classe === "material") mat += total;
      else serv += total;
    });
    return { serv, mat, geral: serv + mat };
  }, [items, bdiServicePct, bdiMaterialPct]);

  const handleExport = async () => {
    if (items.length === 0) {
      toast({ title: "Adicione itens antes de exportar", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const payload = {
        projectId,
        scenarioId,
        proposalNumber,
        budgetVersion,
        projectName,
        bdiServicePct,
        bdiMaterialPct,
        clientTemplateId: templateId === "megasteam" ? null : templateId,
        items: items.map((it) => ({
          numero: it.numero,
          descricao: it.descricao,
          quantidade: Number(it.quantidade) || 0,
          unidade: it.unidade || "",
          custo_unitario: Number(it.custo_unitario) || 0,
          bdi_pct: it.classe === "material" ? bdiMaterialPct : bdiServicePct,
          classe: it.classe,
          is_group: !!it.is_group,
          parent_numero: null,
        })),
      };

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cpu-xlsx`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Erro ${res.status}`);
      }

      const blob = await res.blob();
      const dl = document.createElement("a");
      dl.href = URL.createObjectURL(blob);
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="(.+?)"/);
      dl.download = match?.[1] || `CPU_${projectName}_v${budgetVersion}.xlsx`;
      dl.click();
      URL.revokeObjectURL(dl.href);

      toast({ title: "CPU exportada", description: dl.download });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e?.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const itemsByClass = (c: CpuItemDraft["classe"]) => items.filter((it) => it.classe === c);

  const renderSection = (title: string, classe: CpuItemDraft["classe"]) => {
    const list = itemsByClass(classe);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">{title}</h4>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
              onClick={() => addItem(classe, true)}>
              <FolderTree className="w-3 h-3" /> Grupo
            </Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => addItem(classe)}>
              <Plus className="w-3 h-3" /> Item
            </Button>
          </div>
        </div>
        {list.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-2 py-1">Sem itens nesta seção.</p>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left p-1.5 px-2 font-medium w-20">Item</th>
                  <th className="text-left p-1.5 px-2 font-medium">Descrição</th>
                  <th className="text-right p-1.5 font-medium w-20">Qtde</th>
                  <th className="text-center p-1.5 font-medium w-16">Un.</th>
                  <th className="text-right p-1.5 font-medium w-28">Custo Un. (R$)</th>
                  <th className="text-right p-1.5 font-medium w-28">Total c/ BDI</th>
                  <th className="w-32"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((it) => {
                  const bdi = classe === "material" ? bdiMaterialPct : bdiServicePct;
                  const total = it.is_group ? 0 : it.custo_unitario * (1 + bdi / 100) * it.quantidade;
                  const depth = it.numero ? it.numero.split(".").length - 1 : 0;
                  return (
                    <tr key={it.id} className={cn("border-t border-border/40", it.is_group && "bg-amber-500/5")}>
                      <td className="p-1 px-2 font-mono text-muted-foreground">{it.numero}</td>
                      <td className="p-1">
                        <div style={{ paddingLeft: Math.max(0, (depth - 1) * 16) }}>
                          <Input
                            className={cn("h-7 text-xs", it.is_group && "font-semibold text-foreground")}
                            value={it.descricao}
                            onChange={(e) => updateItem(it.id, { descricao: e.target.value })}
                          />
                        </div>
                      </td>
                      <td className="p-1">
                        {!it.is_group && (
                          <Input type="number" step="0.01" min={0}
                            className="h-7 text-xs text-right font-mono"
                            value={it.quantidade}
                            onChange={(e) => updateItem(it.id, { quantidade: +e.target.value })}
                          />
                        )}
                      </td>
                      <td className="p-1">
                        {!it.is_group && (
                          <Input className="h-7 text-xs text-center" value={it.unidade}
                            onChange={(e) => updateItem(it.id, { unidade: e.target.value })} />
                        )}
                      </td>
                      <td className="p-1">
                        {!it.is_group && (
                          <Input type="number" step="0.01" min={0}
                            className="h-7 text-xs text-right font-mono"
                            value={Number(it.custo_unitario.toFixed(2))}
                            onChange={(e) => updateItem(it.id, { custo_unitario: +e.target.value })}
                          />
                        )}
                      </td>
                      <td className="p-1.5 text-right font-mono text-foreground">
                        {!it.is_group ? formatBRL(total) : "—"}
                      </td>
                      <td className="p-1 flex items-center gap-0.5">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Indentar"
                          onClick={() => indent(it.id)}><IndentIncrease className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Desfazer indentação"
                          onClick={() => outdent(it.id)}><IndentDecrease className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                          onClick={() => moveItem(it.id, -1)}><ArrowUp className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                          onClick={() => moveItem(it.id, 1)}><ArrowDown className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive"
                          onClick={() => removeItem(it.id)}><Trash2 className="w-3 h-3" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const activeTpl = templates.find((t) => t.id === templateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Exportar CPU — Planilha de Preços Unitários
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs flex-wrap">
            Revise itens, defina hierarquia (1.1 → 1.1.1) e escolha o formato.
            <span className="text-muted-foreground">
              · BDI Serv {bdiServicePct.toFixed(2)}% · BDI Mat {bdiMaterialPct.toFixed(2)}%
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-1">
          <label className="text-xs font-medium text-muted-foreground">Formato:</label>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="h-8 text-xs rounded border border-input bg-background px-2 min-w-[260px]"
          >
            <option value="megasteam">Padrão Megasteam</option>
            {templates.filter((t) => t.is_active).map((t) => (
              <option key={t.id} value={t.id}>Cliente: {t.client_name}</option>
            ))}
          </select>
          {activeTpl && (
            <Badge variant="outline" className="text-[10px]">
              {activeTpl.original_file_name}
            </Badge>
          )}
        </div>

        <ScrollArea className="flex-1 pr-3">
          <div className="space-y-5 pb-2">
            {renderSection("1 — Mobilização e Desmobilização", "mob")}
            {renderSection("2 — Serviços", "service")}
            {renderSection("3 — Materiais", "material")}
          </div>
        </ScrollArea>

        <div className="border-t border-border pt-3 mt-2 grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Subtotal Serviços</p>
            <p className="text-sm font-mono font-bold text-foreground">{formatBRL(totals.serv)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Subtotal Materiais</p>
            <p className="text-sm font-mono font-bold text-foreground">{formatBRL(totals.mat)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Geral</p>
            <p className="text-base font-mono font-bold text-primary">{formatBRL(totals.geral)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {exporting ? "Gerando..." : "Exportar .xlsx"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CpuExportDialog;
