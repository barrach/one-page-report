import { useState } from "react";
import { TableCell, TableRow } from "@budget/components/ui/table";
import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Input } from "@budget/components/ui/input";
import { AlertTriangle, CheckCircle2, Layers, EyeOff, Eye, Save, X, Pencil } from "lucide-react";
import { formatBRL } from "@budget/lib/format";
import { useUpdateEntry } from "@budget/hooks/useFinancial";
import { cn } from "@budget/lib/utils";

export type EntryRow = {
  id: string;
  is_excluded: boolean;
  is_duplicate: boolean;
  review_status: string;
  issue_date: string | null;
  supplier: string | null;
  managerial_code: string | null;
  cost_center_description: string | null;
  category_id: string | null;
  contract_project_id: string | null;
  cost_value: number | string;
  competence: string | null;
  competence_date: string | null;
  installment_group: string | null;
  installment_number: number | null;
  installment_total: number | null;
  installment_base_value: number | string | null;
  exclusion_reason: string | null;
  financial_categories?: { id: string; name: string; code: string } | null;
  projects?: { id: string; project_name: string } | null;
};

type Props = {
  entry: EntryRow;
  categories: { id: string; name: string; code: string }[];
  projects: { id: string; project_name: string; client?: string | null; dept_code?: string | null }[];
};

// Build last 18 months of competence options (YYYY-MM-01)
const buildCompetenceOptions = () => {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -3; i <= 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    opts.push({ value, label: label.replace(".", "").replace(/^./, (c) => c.toUpperCase()) });
  }
  return opts;
};

const COMPETENCE_OPTIONS = buildCompetenceOptions();

const EntryReviewRow = ({ entry, categories, projects }: Props) => {
  const [editing, setEditing] = useState(false);
  const [catId, setCatId] = useState<string>(entry.category_id ?? "");
  const [projId, setProjId] = useState<string>(entry.contract_project_id ?? "");
  const [baseValue, setBaseValue] = useState<string>(
    entry.installment_base_value ? String(entry.installment_base_value) : String(entry.cost_value)
  );
  const [costValue, setCostValue] = useState<string>(String(entry.cost_value));
  const [costCenterDesc, setCostCenterDesc] = useState<string>(entry.cost_center_description ?? "");
  const [competenceDate, setCompetenceDate] = useState<string>(
    entry.competence_date ?? COMPETENCE_OPTIONS[3]?.value ?? "",
  );
  const update = useUpdateEntry();

  const save = () => {
    const patch: Record<string, unknown> = {
      id: entry.id,
      category_id: catId || null,
      contract_project_id: projId || null,
      cost_center_description: costCenterDesc || null,
    };
    // Only set competence_date when changed (avoid overwriting with empty)
    if (competenceDate && competenceDate !== entry.competence_date) {
      patch.competence_date = competenceDate;
    }
    // Cost value (only when not part of an installment group — there we edit base)
    if (entry.installment_group) {
      patch.installment_base_value = Number(baseValue) || null;
    } else if (Number(costValue) !== Number(entry.cost_value)) {
      patch.cost_value = Number(costValue);
    }
    update.mutate(patch as { id: string }, { onSuccess: () => setEditing(false) });
  };

  const toggleExcluded = () => {
    update.mutate({
      id: entry.id,
      is_excluded: !entry.is_excluded,
      exclusion_reason: !entry.is_excluded ? "Excluído manualmente" : null,
    });
  };

  return (
    <TableRow
      data-editing={editing ? "true" : undefined}
      className={cn(
        // Ultra-compact rows — same density as a financial spreadsheet
        "[&>td]:px-1 [&>td]:py-1 [&>td]:text-[10px]",
        entry.is_excluded && "opacity-50",
        entry.is_duplicate && "opacity-60",
        editing && "bg-muted/30",
      )}
    >
      <TableCell>
        <div className="flex flex-wrap gap-0.5">
          {entry.is_duplicate && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 leading-none">
              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />Dup
            </Badge>
          )}
          {entry.is_excluded && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1 leading-none">Excl</Badge>
          )}
          {entry.installment_group && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 leading-none bg-amber-500/10 text-amber-700">
              <Layers className="w-2.5 h-2.5 mr-0.5" />
              {entry.installment_number}/{entry.installment_total}
            </Badge>
          )}
          {entry.review_status === "needs_review" && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 leading-none bg-amber-500/10 text-amber-700">Rev</Badge>
          )}
          {entry.review_status === "manual_override" && (
            <Badge className="text-[9px] h-4 px-1 leading-none bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20">
              <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />Ed
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {entry.issue_date ? new Date(entry.issue_date).toLocaleDateString("pt-BR") : "—"}
      </TableCell>
      <TableCell title={entry.supplier ?? ""}>
        {entry.supplier ?? "—"}
      </TableCell>
      <TableCell className="font-mono">{entry.managerial_code ?? "—"}</TableCell>
      <TableCell>
        {editing ? (
          <Input
            value={costCenterDesc}
            onChange={(e) => setCostCenterDesc(e.target.value)}
            className="h-6 text-[10px] px-1.5"
            placeholder="Centro de custo"
          />
        ) : (
          <span className="block truncate" title={entry.cost_center_description ?? ""}>
            {entry.cost_center_description ?? "—"}
          </span>
        )}
      </TableCell>
      <TableCell>
        {editing ? (
          <Select value={catId || "__none__"} onValueChange={(v) => setCatId(v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-6 text-[10px] px-1.5"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs">Sem categoria</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">{c.code} · {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="block truncate" title={entry.financial_categories?.name ?? ""}>
            {entry.financial_categories?.name ?? <span className="text-muted-foreground">—</span>}
          </span>
        )}
      </TableCell>
      <TableCell>
        {editing ? (
          <Select value={projId || "__none__"} onValueChange={(v) => setProjId(v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-6 text-[10px] px-1.5"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs">Sem contrato</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.dept_code ? `${p.dept_code} · ` : ""}{p.project_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="block truncate" title={entry.projects?.project_name ?? ""}>
            {entry.projects?.project_name ?? <span className="text-muted-foreground italic">Não vinculado</span>}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {editing ? (
          entry.installment_group ? (
            <Input
              type="number"
              step="0.01"
              value={baseValue}
              onChange={(e) => setBaseValue(e.target.value)}
              className="h-6 text-[10px] px-1.5 text-right"
              title="Valor real (corrigir parcela)"
            />
          ) : (
            <Input
              type="number"
              step="0.01"
              value={costValue}
              onChange={(e) => setCostValue(e.target.value)}
              className="h-6 text-[10px] px-1.5 text-right"
            />
          )
        ) : (
          <>
            {formatBRL(Number(entry.cost_value))}
            {entry.installment_base_value && (
              <div className="text-[9px] text-amber-600 leading-tight">
                base: {formatBRL(Number(entry.installment_base_value))}
              </div>
            )}
          </>
        )}
      </TableCell>
      <TableCell>
        {editing ? (
          <Select value={competenceDate} onValueChange={setCompetenceDate}>
            <SelectTrigger className="h-6 text-[10px] px-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMPETENCE_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          entry.competence ?? (entry.competence_date ?? "—")
        )}
      </TableCell>
      <TableCell>
        <div className="flex gap-0.5 justify-end">
          {editing ? (
            <>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={save} disabled={update.isPending} title="Salvar">
                <Save className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditing(false)} title="Cancelar">
                <X className="w-3 h-3" />
              </Button>
            </>
          ) : (
            <>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditing(true)} title="Editar linha">
                <Pencil className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={toggleExcluded} title={entry.is_excluded ? "Reincluir" : "Excluir"}>
                {entry.is_excluded ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default EntryReviewRow;
