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
import { Plus, Trash2, Users, Sparkles } from "lucide-react";
import { usePayrollEntries, useUpsertPayroll, useDeletePayroll } from "@budget/hooks/useFinancialModules";
import { usePayrollFromEntries, usePayrollHeadcount, useManualPayrollByMonth } from "@budget/hooks/usePayrollFromEntries";
import { useProjectsList } from "@budget/hooks/useFinancial";
import { useFinancialWorkspace } from "@budget/hooks/useFinancialWorkspace";
import { formatBRL } from "@budget/lib/format";

const FinanceiroPessoal = () => {
  const { contractId } = useFinancialWorkspace();
  const { data: payrollAuto, isLoading: loadingAuto } = usePayrollFromEntries(contractId ?? undefined);
  const { data: headcountByMonth } = usePayrollHeadcount(contractId ?? undefined);
  const { data: manualByMonth } = useManualPayrollByMonth(contractId ?? undefined);
  const { data: manualEntries, isLoading: loadingManual } = usePayrollEntries({ projectId: contractId ?? undefined });
  const { data: projects } = useProjectsList();
  const upsert = useUpsertPayroll();
  const remove = useDeletePayroll();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    competence_month: "", contract_project_id: "none",
    headcount: "", gross_payroll: "", charges: "", benefits: "", notes: "",
  });

  const handleSave = async () => {
    if (!form.competence_month) return;
    await upsert.mutateAsync({
      competence_month: `${form.competence_month}-01`,
      contract_project_id: form.contract_project_id === "none" ? (contractId ?? null) : form.contract_project_id,
      headcount: Number(form.headcount || 0),
      gross_payroll: Number(form.gross_payroll || 0),
      charges: Number(form.charges || 0),
      benefits: Number(form.benefits || 0),
      notes: form.notes || undefined,
    });
    setOpen(false);
    setForm({ competence_month: "", contract_project_id: "none", headcount: "", gross_payroll: "", charges: "", benefits: "", notes: "" });
  };

  // Combine automatic (from CUSTOS_MES) + manual entries by month
  const combinedRows = useMemo(() => {
    const map = new Map<string, {
      month: string; gross: number; charges: number; fgts: number; inss: number; benefits: number;
      total: number; hasAuto: boolean; hasManual: boolean; headcount: number;
    }>();
    for (const r of payrollAuto?.rows ?? []) {
      map.set(r.competence_month, {
        month: r.competence_month,
        gross: r.gross, charges: r.charges, fgts: r.fgts, inss: r.inss, benefits: r.benefits,
        total: r.total, hasAuto: true, hasManual: false,
        headcount: headcountByMonth?.[r.competence_month]?.headcount ?? 0,
      });
    }
    for (const [month, m] of Object.entries(manualByMonth ?? {})) {
      const cur = map.get(month) ?? {
        month, gross: 0, charges: 0, fgts: 0, inss: 0, benefits: 0, total: 0,
        hasAuto: false, hasManual: false,
        headcount: headcountByMonth?.[month]?.headcount ?? 0,
      };
      cur.gross += m.gross;
      cur.charges += m.charges;
      cur.benefits += m.benefits;
      cur.total = cur.gross + cur.charges + cur.benefits;
      cur.hasManual = true;
      map.set(month, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [payrollAuto, manualByMonth, headcountByMonth]);

  const isLoading = loadingAuto || loadingManual;
  if (isLoading) return <Skeleton className="h-64" />;

  // Top cards: latest competence (most recent month with data)
  const latest = combinedRows[0];
  const headcountMax = Math.max(0, ...combinedRows.map((r) => r.headcount));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Headcount máximo</p>
          <p className="text-2xl font-bold tabular-nums">{headcountMax}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Lance manualmente por mês</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Folha Bruta {latest ? `(${latest.month})` : ""}</p>
          <p className="text-xl font-bold tabular-nums">{formatBRL(latest?.gross ?? 0)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">C Gerenc 4101</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Encargos {latest ? `(${latest.month})` : ""}</p>
          <p className="text-xl font-bold tabular-nums">{formatBRL(latest?.charges ?? 0)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">4102 + 4109 + 3201</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Benefícios {latest ? `(${latest.month})` : ""}</p>
          <p className="text-xl font-bold tabular-nums">{formatBRL(latest?.benefits ?? 0)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">4112 + 4113 + 4114 + 4111</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Folha de pagamento
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Linhas com <Sparkles className="inline w-3 h-3" /> vêm automaticamente do CUSTOS_MES (filtrado pelo CR deste contrato
              {payrollAuto?.deptCode ? ` — ${payrollAuto.deptCode}` : ""}). Lançamentos manuais somam com os automáticos.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Lançar folha</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Folha de pagamento (manual)</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Competência</Label>
                    <Input type="month" value={form.competence_month} onChange={(e) => setForm((f) => ({ ...f, competence_month: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Headcount</Label>
                    <Input type="number" value={form.headcount} onChange={(e) => setForm((f) => ({ ...f, headcount: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Contrato</Label>
                  <Select value={form.contract_project_id} onValueChange={(v) => setForm((f) => ({ ...f, contract_project_id: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Contrato atual</SelectItem>
                      {(projects ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Folha bruta</Label>
                    <Input type="number" value={form.gross_payroll} onChange={(e) => setForm((f) => ({ ...f, gross_payroll: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Encargos</Label>
                    <Input type="number" value={form.charges} onChange={(e) => setForm((f) => ({ ...f, charges: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Benefícios</Label>
                    <Input type="number" value={form.benefits} onChange={(e) => setForm((f) => ({ ...f, benefits: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={upsert.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Headcount</TableHead>
                  <TableHead className="text-right">Folha Bruta</TableHead>
                  <TableHead className="text-right">Encargos</TableHead>
                  <TableHead className="text-right">FGTS</TableHead>
                  <TableHead className="text-right">INSS</TableHead>
                  <TableHead className="text-right">Benefícios</TableHead>
                  <TableHead className="text-right">Total Pessoal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedRows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                    Sem dados de folha. Os lançamentos do CUSTOS_MES (4101, 4102, 4109, 3201, 4112-4114, 4111) aparecerão aqui automaticamente.
                  </TableCell></TableRow>
                ) : combinedRows.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell className="font-medium">{r.month}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {r.hasAuto && <Badge variant="secondary" className="text-[10px]"><Sparkles className="w-3 h-3 mr-1" />CUSTOS_MES</Badge>}
                        {r.hasManual && <Badge variant="outline" className="text-[10px]">Manual</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.headcount || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(r.gross)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(r.charges)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatBRL(r.fgts)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatBRL(r.inss)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(r.benefits)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatBRL(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {(manualEntries && manualEntries.length > 0) && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Lançamentos manuais (editáveis)</p>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competência</TableHead>
                      <TableHead className="text-right">Headcount</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">Encargos</TableHead>
                      <TableHead className="text-right">Benefícios</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualEntries.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{String(p.competence_month).slice(0, 7)}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.headcount}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBRL(Number(p.gross_payroll))}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBRL(Number(p.charges))}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBRL(Number(p.benefits))}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => remove.mutate(p.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceiroPessoal;
