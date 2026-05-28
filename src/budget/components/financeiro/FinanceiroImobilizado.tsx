import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Label } from "@budget/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@budget/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Badge } from "@budget/components/ui/badge";
import { Plus, Trash2, Building2, Upload, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  useFixedAssets, useFixedAssetEntries,
  useUpsertFixedAsset, useDeleteFixedAsset, useImportFixedAssets,
} from "@budget/hooks/useFinancialModules";
import { useProjectsList } from "@budget/hooks/useFinancial";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { formatBRL } from "@budget/lib/format";
import { parseImobilizadoFromFile, type ImobParseReport } from "@budget/lib/imobilizadoXlsxParser";
import { toast } from "@budget/hooks/use-toast";

const MONTH_LABELS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const PG_OPTIONS = ["7.51","7.52","7.53","7.54","7.55","7.56","7.57","7.58","7.59","7.60","7.61","7.62","7.63","7.64","7.65","7.66"];

const FinanceiroImobilizado = () => {
  const { contractId } = useFinancialWorkspace();
  const { data: assets, isLoading } = useFixedAssets({ projectId: contractId ?? undefined });
  const { data: entries } = useFixedAssetEntries({ projectId: contractId ?? undefined });
  const { data: projects } = useProjectsList();
  const upsert = useUpsertFixedAsset();
  const remove = useDeleteFixedAsset();
  const importer = useImportFixedAssets();

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [parseReport, setParseReport] = useState<ImobParseReport | null>(null);
  const [parsing, setParsing] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());

  const [form, setForm] = useState({
    description: "", supplier: "", contract_project_id: "none",
    acquisition_value: "", acquisition_date: "", amortization_months: "60",
    conta_pg: "7.51", nf: "", depto: "", notes: "",
  });

  const handleSave = async () => {
    if (!form.description || !form.acquisition_date) return;
    await upsert.mutateAsync({
      description: form.description,
      supplier: form.supplier || undefined,
      contract_project_id: form.contract_project_id === "none" ? null : form.contract_project_id,
      acquisition_value: Number(form.acquisition_value || 0),
      acquisition_date: form.acquisition_date,
      amortization_months: Number(form.amortization_months || 1),
      conta_pg: form.conta_pg || null,
      nf: form.nf || null,
      depto: form.depto || null,
      notes: form.notes || undefined,
    });
    setOpen(false);
    setForm({ description: "", supplier: "", contract_project_id: "none", acquisition_value: "", acquisition_date: "", amortization_months: "60", conta_pg: "7.51", nf: "", depto: "", notes: "" });
  };

  // ---------- Importer ----------
  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const report = await parseImobilizadoFromFile(file);
      // Mapear dept_code → contract_project_id
      const codeToId = new Map<string, string>();
      (projects ?? []).forEach((p) => { if (p.dept_code) codeToId.set(p.dept_code, p.id); });
      report.assets.forEach((a) => {
        // anexa o id resolvido como pseudo-prop
        (a as ImobParseReport["assets"][number] & { contract_project_id?: string | null }).contract_project_id =
          a.is_headquarters ? null : (a.dept_code ? codeToId.get(a.dept_code) ?? null : null);
      });
      setParseReport(report);
    } catch (e) {
      toast({ title: "Erro ao ler arquivo", description: (e as Error).message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const confirmImport = async () => {
    if (!parseReport) return;
    const codeToId = new Map<string, string>();
    (projects ?? []).forEach((p) => { if (p.dept_code) codeToId.set(p.dept_code, p.id); });
    await importer.mutateAsync({
      assets: parseReport.assets.map((a) => ({
        external_item_id: a.external_item_id,
        description: a.description,
        supplier: a.supplier,
        nf: a.nf,
        conta_pg: a.conta_pg,
        depto: a.depto,
        contract_project_id: a.is_headquarters ? null : (a.dept_code ? codeToId.get(a.dept_code) ?? null : null),
        is_headquarters: a.is_headquarters,
        acquisition_date: a.acquisition_date,
        acquisition_value: a.acquisition_value,
        amortization_months: a.amortization_months,
        quota_mensal: a.quota_mensal,
      })),
      entries: parseReport.entries,
    });
    setParseReport(null);
    setImportOpen(false);
  };

  // ---------- KPIs ----------
  const totalValue = (assets ?? []).reduce((s, a) => s + Number(a.acquisition_value || 0), 0);
  const monthlyDistributed = (assets ?? []).reduce((s, a) => s + Number(a.quota_mensal || 0), 0);
  const activeCount = (assets ?? []).filter((a) => a.status === "active" || !a.status).length;

  // ---------- Depreciação por mês do ano selecionado ----------
  const monthlyDep = useMemo(() => {
    const m = new Map<number, number>(); // 1..12 → soma
    for (const e of entries ?? []) {
      if (e.entry_type !== "depreciacao") continue;
      const ym = String(e.competence_month);
      const y = Number(ym.slice(0, 4));
      if (y !== year) continue;
      const mo = Number(ym.slice(5, 7));
      m.set(mo, (m.get(mo) ?? 0) + Number(e.value || 0));
    }
    return m;
  }, [entries, year]);

  const yearTotal = Array.from(monthlyDep.values()).reduce((s, v) => s + v, 0);

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Total imobilizado</p>
          <p className="text-2xl font-bold tabular-nums">{formatBRL(totalValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Quota mensal total</p>
          <p className="text-2xl font-bold tabular-nums">{formatBRL(monthlyDistributed)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Ativos ativos</p>
          <p className="text-2xl font-bold tabular-nums">{activeCount} <span className="text-sm font-normal text-muted-foreground">/ {(assets ?? []).length}</span></p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Depreciação {year}</p>
          <p className="text-2xl font-bold tabular-nums">{formatBRL(yearTotal)}</p>
        </CardContent></Card>
      </div>

      {/* Calendário mensal */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Depreciação mensal — {year}</CardTitle>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
            {MONTH_LABELS.map((label, idx) => {
              const v = monthlyDep.get(idx + 1) ?? 0;
              return (
                <div key={label} className="rounded border bg-card p-2 text-center">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="text-sm font-semibold tabular-nums">{v ? formatBRL(v) : "—"}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Cadastro */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Imobilizado · Ativos
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Ativos depreciados linearmente; depreciação substitui o Realizado das linhas PG 7.51-7.66 no Acompanhamento Executivo.
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setParseReport(null); }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Upload className="w-4 h-4 mr-1" /> Importar XLSX</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Importar aba "Imobilizado" (Comparativo Megasteam)</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  {!parseReport && (
                    <div>
                      <Label>Arquivo XLSX</Label>
                      <Input type="file" accept=".xlsx,.xlsm" disabled={parsing} onChange={(e) => {
                        const f = e.target.files?.[0]; if (f) handleFile(f);
                      }} />
                      {parsing && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Lendo aba Imobilizado…</p>}
                    </div>
                  )}
                  {parseReport && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span><strong>{parseReport.assets.length}</strong> ativos · <strong>{parseReport.entries.length}</strong> lançamentos · {parseReport.skippedRows} ignorados</span>
                      </div>
                      {parseReport.warnings.length > 0 && (
                        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                          <div className="flex items-center gap-1 font-medium mb-1"><AlertTriangle className="w-3 h-3" /> Avisos</div>
                          <ul className="space-y-0.5">
                            {parseReport.warnings.slice(0, 8).map((w, i) => <li key={i}>• {w}</li>)}
                            {parseReport.warnings.length > 8 && <li>… +{parseReport.warnings.length - 8}</li>}
                          </ul>
                        </div>
                      )}
                      <div className="rounded border max-h-64 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Item</TableHead>
                              <TableHead className="text-xs">Descrição</TableHead>
                              <TableHead className="text-xs">PG</TableHead>
                              <TableHead className="text-xs">Depto → Contrato</TableHead>
                              <TableHead className="text-xs text-right">Valor</TableHead>
                              <TableHead className="text-xs text-right">Meses</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parseReport.assets.slice(0, 50).map((a) => {
                              const codeToId = new Map<string, string>();
                              (projects ?? []).forEach((p) => { if (p.dept_code) codeToId.set(p.dept_code, p.id); });
                              const proj = a.dept_code ? (projects ?? []).find((p) => p.dept_code === a.dept_code) : null;
                              return (
                                <TableRow key={a.external_item_id}>
                                  <TableCell className="text-xs">{a.external_item_id}</TableCell>
                                  <TableCell className="text-xs">{a.description}</TableCell>
                                  <TableCell className="text-xs">{a.conta_pg}</TableCell>
                                  <TableCell className="text-xs">
                                    {a.is_headquarters ? <Badge variant="outline">SEDE/ADM</Badge> : (proj?.project_name ?? <span className="text-amber-500">{a.dept_code} (não mapeado)</span>)}
                                  </TableCell>
                                  <TableCell className="text-xs text-right tabular-nums">{formatBRL(a.acquisition_value)}</TableCell>
                                  <TableCell className="text-xs text-right tabular-nums">{a.amortization_months}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        {parseReport.assets.length > 50 && (
                          <p className="text-xs text-muted-foreground p-2 text-center">… +{parseReport.assets.length - 50} ativos</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setImportOpen(false); setParseReport(null); }}>Cancelar</Button>
                  <Button disabled={!parseReport || importer.isPending} onClick={confirmImport}>
                    {importer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar importação"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Cadastrar ativo</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo ativo imobilizado</DialogTitle></DialogHeader>
                <div className="space-y-3 py-2">
                  <div>
                    <Label>Descrição</Label>
                    <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Ex.: Compressor industrial" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Fornecedor</Label>
                      <Input value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} />
                    </div>
                    <div>
                      <Label>NF</Label>
                      <Input value={form.nf} onChange={(e) => setForm((f) => ({ ...f, nf: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Conta PG</Label>
                      <Select value={form.conta_pg} onValueChange={(v) => setForm((f) => ({ ...f, conta_pg: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PG_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Depto (opcional)</Label>
                      <Input value={form.depto} onChange={(e) => setForm((f) => ({ ...f, depto: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Contrato vinculado (opcional)</Label>
                    <Select value={form.contract_project_id} onValueChange={(v) => setForm((f) => ({ ...f, contract_project_id: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Corporativo (SEDE/ADM)</SelectItem>
                        {(projects ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.project_name} {p.dept_code ? `(${p.dept_code})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Data aquisição</Label>
                      <Input type="date" value={form.acquisition_date} onChange={(e) => setForm((f) => ({ ...f, acquisition_date: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Valor</Label>
                      <Input type="number" value={form.acquisition_value} onChange={(e) => setForm((f) => ({ ...f, acquisition_value: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Vida útil (meses)</Label>
                      <Input type="number" value={form.amortization_months} onChange={(e) => setForm((f) => ({ ...f, amortization_months: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} disabled={upsert.isPending}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>PG</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Aquisição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Meses</TableHead>
                  <TableHead className="text-right">Quota</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!assets || assets.length === 0) ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                    Nenhum ativo cadastrado.
                  </TableCell></TableRow>
                ) : assets.map((a) => {
                  const proj = (a as { projects?: { project_name?: string } }).projects;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs tabular-nums">{a.external_item_id ?? "—"}</TableCell>
                      <TableCell className="font-medium">
                        <div className="text-sm">{a.description}</div>
                        {a.supplier && <div className="text-xs text-muted-foreground">{a.supplier}{a.nf ? ` · NF ${a.nf}` : ""}</div>}
                      </TableCell>
                      <TableCell className="text-xs">{a.conta_pg ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {proj?.project_name ?? <Badge variant="outline" className="text-xs">Corporativo</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{String(a.acquisition_date).slice(0, 10)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatBRL(Number(a.acquisition_value))}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{a.amortization_months}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{formatBRL(Number(a.quota_mensal || 0))}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => remove.mutate(a.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceiroImobilizado;
