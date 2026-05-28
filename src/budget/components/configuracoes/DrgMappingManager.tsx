// ============================================================
// DrgMappingManager
// Gerencia o mapeamento C Gerenc → Linha PG / Classe DRG.
// Usa a tabela `drg_managerial_mapping`. Mapeamentos globais
// (user_id NULL) aparecem como leitura-only para usuários não-admin.
// ============================================================

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Switch } from "@budget/components/ui/switch";
import { Badge } from "@budget/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Plus, Save, Trash2, AlertTriangle, RotateCw, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@budget/hooks/useAuth";

interface DrgMapping {
  id: string;
  user_id: string | null;
  c_gerenc: string;
  gerenc_description: string | null;
  linha_pg: string;
  pg_description: string | null;
  drg_class: "PESSOAL" | "DIRETO" | "INDIRETO" | "OUTRO";
  is_active: boolean;
}

const DRG_CLASS_STYLES: Record<DrgMapping["drg_class"], string> = {
  PESSOAL:  "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400",
  DIRETO:   "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400",
  INDIRETO: "bg-purple-500/15 text-purple-600 border-purple-500/30 dark:text-purple-400",
  OUTRO:    "bg-muted text-muted-foreground border-border",
};

const emptyDraft = {
  c_gerenc: "",
  gerenc_description: "",
  linha_pg: "",
  pg_description: "",
  drg_class: "INDIRETO" as DrgMapping["drg_class"],
  is_active: true,
};

const DrgMappingManager = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const uid = user?.id;
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(emptyDraft);

  // Mapeamentos
  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ["drg-managerial-mapping"],
    queryFn: async (): Promise<DrgMapping[]> => {
      const { data, error } = await (supabase as any)
        .from("drg_managerial_mapping")
        .select("*")
        .order("c_gerenc", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DrgMapping[];
    },
  });

  // Contador de "sem categoria"
  const { data: semCategoriaCount = 0 } = useQuery({
    queryKey: ["financial-entries-sem-categoria-count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("financial_entries")
        .select("id", { count: "exact", head: true })
        .eq("mapping_status", "sem_categoria")
        .eq("is_excluded", false);
      if (error) return 0;
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mappings;
    return mappings.filter((m) =>
      m.c_gerenc.toLowerCase().includes(q) ||
      m.linha_pg.toLowerCase().includes(q) ||
      (m.pg_description ?? "").toLowerCase().includes(q) ||
      (m.gerenc_description ?? "").toLowerCase().includes(q)
    );
  }, [mappings, search]);

  // Mutações ------------------------------------------------------
  const saveOne = useMutation({
    mutationFn: async (input: Omit<DrgMapping, "id" | "user_id"> & { id?: string }) => {
      if (!uid) throw new Error("Sessão expirada");
      if (!input.c_gerenc.trim()) throw new Error("C Gerenc obrigatório");
      if (!input.linha_pg.trim()) throw new Error("Linha PG obrigatória");
      const payload = {
        user_id: uid,
        c_gerenc: input.c_gerenc.trim(),
        gerenc_description: input.gerenc_description?.trim() || null,
        linha_pg: input.linha_pg.trim(),
        pg_description: input.pg_description?.trim() || null,
        drg_class: input.drg_class,
        is_active: input.is_active,
      };
      if (input.id) {
        const { error } = await (supabase as any)
          .from("drg_managerial_mapping")
          .update(payload)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("drg_managerial_mapping")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drg-managerial-mapping"] });
      qc.invalidateQueries({ queryKey: ["financial-entries-sem-categoria-count"] });
      toast.success("Mapeamento salvo (lançamentos reprocessados)");
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const removeOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("drg_managerial_mapping")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drg-managerial-mapping"] });
      toast.success("Mapeamento removido");
    },
    onError: (e: Error) => toast.error("Erro ao remover", { description: e.message }),
  });

  const reapplyAll = useMutation({
    mutationFn: async () => {
      if (!uid) throw new Error("Sessão expirada");
      const { error } = await (supabase as any).rpc("apply_drg_mapping_to_entries", {
        _user_id: uid,
        _c_gerenc: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial-entries-sem-categoria-count"] });
      toast.success("Reprocessamento concluído");
    },
    onError: (e: Error) => toast.error("Erro ao reprocessar", { description: e.message }),
  });

  // ---------------------------------------------------------------
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Categorias DRG / Mapeamento de Custos</CardTitle>
            <CardDescription className="text-xs">
              Define como o campo <strong>C Gerenc</strong> do CUSTOS_MES vira linha do Plano Gerencial (PG).
              Mapeamentos novos reprocessam automaticamente os lançamentos existentes.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {semCategoriaCount > 0 && (
              <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400 gap-1">
                <AlertTriangle className="w-3 h-3" />
                {semCategoriaCount} sem categoria
              </Badge>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => reapplyAll.mutate()}
              disabled={reapplyAll.isPending}
              className="gap-1"
            >
              <RotateCw className={`w-3.5 h-3.5 ${reapplyAll.isPending ? "animate-spin" : ""}`} />
              Reprocessar tudo
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ===== Form de novo mapeamento ===== */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <Input
              className="md:col-span-2"
              placeholder="C Gerenc"
              value={draft.c_gerenc}
              onChange={(e) => setDraft({ ...draft, c_gerenc: e.target.value })}
            />
            <Input
              className="md:col-span-3"
              placeholder="Descrição do Gerenc"
              value={draft.gerenc_description}
              onChange={(e) => setDraft({ ...draft, gerenc_description: e.target.value })}
            />
            <Input
              className="md:col-span-1"
              placeholder="Linha PG"
              value={draft.linha_pg}
              onChange={(e) => setDraft({ ...draft, linha_pg: e.target.value })}
            />
            <Input
              className="md:col-span-3"
              placeholder="Descrição PG"
              value={draft.pg_description}
              onChange={(e) => setDraft({ ...draft, pg_description: e.target.value })}
            />
            <Select
              value={draft.drg_class}
              onValueChange={(v) => setDraft({ ...draft, drg_class: v as DrgMapping["drg_class"] })}
            >
              <SelectTrigger className="md:col-span-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PESSOAL">PESSOAL</SelectItem>
                <SelectItem value="DIRETO">DIRETO</SelectItem>
                <SelectItem value="INDIRETO">INDIRETO</SelectItem>
                <SelectItem value="OUTRO">OUTRO</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="md:col-span-1 gap-1"
              size="sm"
              onClick={() =>
                saveOne.mutate(draft, {
                  onSuccess: () => setDraft(emptyDraft),
                })
              }
              disabled={saveOne.isPending}
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>

        {/* ===== Busca ===== */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por C Gerenc, linha PG ou descrição..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* ===== Tabela ===== */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[110px]">C Gerenc</TableHead>
                <TableHead>Descrição Gerenc</TableHead>
                <TableHead className="w-[90px]">Linha PG</TableHead>
                <TableHead>Descrição PG</TableHead>
                <TableHead className="w-[120px]">Classe DRG</TableHead>
                <TableHead className="w-[80px] text-center">Ativo</TableHead>
                <TableHead className="w-[60px] text-right">Origem</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum mapeamento encontrado.</TableCell></TableRow>
              ) : (
                filtered.map((m) => {
                  const isGlobal = m.user_id === null;
                  const editable = !isGlobal && m.user_id === uid;
                  return (
                    <EditableRow
                      key={m.id}
                      mapping={m}
                      editable={editable}
                      onSave={(updated) => saveOne.mutate({ ...updated, id: m.id })}
                      onDelete={() => removeOne.mutate(m.id)}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-[11px] text-muted-foreground">
          <strong>Como funciona:</strong> ao importar o CUSTOS_MES, cada lançamento procura seu C Gerenc nesta tabela.
          Encontrado → vai para a Linha PG correspondente no Acompanhamento Executivo do contrato.
          Não encontrado → fica como "Sem categoria" (alerta acima). Adicione o mapeamento e os lançamentos retroagem
          automaticamente.
        </p>
      </CardContent>
    </Card>
  );
};

// ----------------------------------------------------------------
// Linha editável
// ----------------------------------------------------------------
interface EditableRowProps {
  mapping: DrgMapping;
  editable: boolean;
  onSave: (m: Omit<DrgMapping, "id" | "user_id">) => void;
  onDelete: () => void;
}

const EditableRow = ({ mapping, editable, onSave, onDelete }: EditableRowProps) => {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(mapping);

  if (!edit) {
    return (
      <TableRow className="hover:bg-muted/30">
        <TableCell className="font-mono text-xs">{mapping.c_gerenc}</TableCell>
        <TableCell className="text-xs">{mapping.gerenc_description ?? "—"}</TableCell>
        <TableCell className="font-mono text-xs">{mapping.linha_pg}</TableCell>
        <TableCell className="text-xs">{mapping.pg_description ?? "—"}</TableCell>
        <TableCell>
          <Badge variant="outline" className={`text-[10px] ${DRG_CLASS_STYLES[mapping.drg_class]}`}>
            {mapping.drg_class}
          </Badge>
        </TableCell>
        <TableCell className="text-center">
          <Switch
            checked={mapping.is_active}
            disabled={!editable}
            onCheckedChange={(v) => onSave({ ...mapping, is_active: v })}
          />
        </TableCell>
        <TableCell className="text-right">
          <Badge variant="outline" className="text-[9px]">
            {mapping.user_id === null ? "Sistema" : "Você"}
          </Badge>
        </TableCell>
        <TableCell>
          {editable && (
            <div className="flex items-center justify-end gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEdit(true)}>
                <Save className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="bg-primary/5">
      <TableCell><Input value={draft.c_gerenc} onChange={(e) => setDraft({ ...draft, c_gerenc: e.target.value })} className="h-7 text-xs font-mono" /></TableCell>
      <TableCell><Input value={draft.gerenc_description ?? ""} onChange={(e) => setDraft({ ...draft, gerenc_description: e.target.value })} className="h-7 text-xs" /></TableCell>
      <TableCell><Input value={draft.linha_pg} onChange={(e) => setDraft({ ...draft, linha_pg: e.target.value })} className="h-7 text-xs font-mono" /></TableCell>
      <TableCell><Input value={draft.pg_description ?? ""} onChange={(e) => setDraft({ ...draft, pg_description: e.target.value })} className="h-7 text-xs" /></TableCell>
      <TableCell>
        <Select value={draft.drg_class} onValueChange={(v) => setDraft({ ...draft, drg_class: v as DrgMapping["drg_class"] })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="PESSOAL">PESSOAL</SelectItem>
            <SelectItem value="DIRETO">DIRETO</SelectItem>
            <SelectItem value="INDIRETO">INDIRETO</SelectItem>
            <SelectItem value="OUTRO">OUTRO</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-center">
        <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
      </TableCell>
      <TableCell></TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="default" className="h-7 px-2 text-xs" onClick={() => { onSave(draft); setEdit(false); }}>
            Salvar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setDraft(mapping); setEdit(false); }}>
            ×
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default DrgMappingManager;
