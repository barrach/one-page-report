import { useMemo, useState, useEffect, useRef, Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@budget/components/ui/table";
import { Skeleton } from "@budget/components/ui/skeleton";
import { Pencil, Save, FileSpreadsheet } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { useFinancialCategories } from "@budget/hooks/useFinancial";
import { toast } from "@budget/hooks/use-toast";
import { formatBRL } from "@budget/lib/format";
import { cn } from "@budget/lib/utils";
import { EditableCell } from "./EditableCell";
import BudgetXlsxImporter from "./BudgetXlsxImporter";

interface Props {
  projectId: string;
  /** Optional — when provided, scrolls/highlights this competence column */
  focusCompetenceMonth?: string;
}

type PlannedRow = {
  id: string;
  category_id: string | null;
  competence_month: string;
  planned_value: number | string;
  kind: string;
};

type CategoryRow = {
  id: string;
  code: string;
  name: string;
  drg_group: string | null;
  sort_order: number;
  kind: string;
};

const monthsForYear = (anchor: string) => {
  // anchor = YYYY-MM-01 -> show 12 months centered/forward from start of that year
  const d = new Date(`${anchor}T00:00:00`);
  const year = d.getFullYear();
  return Array.from({ length: 12 }, (_, i) => {
    const m = new Date(year, i, 1);
    return {
      key: `${year}-${String(i + 1).padStart(2, "0")}-01`,
      label: m.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    };
  });
};

const PlannedSpreadsheet = ({ projectId, focusCompetenceMonth }: Props) => {
  const qc = useQueryClient();
  const { data: categories = [], isLoading: lc } = useFinancialCategories() as {
    data: CategoryRow[];
    isLoading: boolean;
  };
  const focusRef = useRef<HTMLTableCellElement | null>(null);

  // Descobre quais anos têm lançamentos planejados deste contrato
  const { data: availableYears = [] } = useQuery({
    queryKey: ["planned-available-years", projectId],
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase
        .from("financial_planned_entries")
        .select("competence_month")
        .eq("project_id", projectId);
      if (error) throw error;
      const years = new Set<number>();
      (data ?? []).forEach((r: { competence_month: string }) => {
        const y = Number(r.competence_month?.slice(0, 4));
        if (Number.isFinite(y)) years.add(y);
      });
      return Array.from(years).sort((a, b) => a - b);
    },
    enabled: !!projectId,
  });

  // Ano âncora selecionado pelo usuário (default: ano do focus, ou primeiro ano com dados, ou ano atual)
  const defaultYear =
    (focusCompetenceMonth && Number(focusCompetenceMonth.slice(0, 4))) ||
    availableYears[0] ||
    new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);

  // Sincroniza quando os anos disponíveis carregam pela primeira vez
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableYears.join(",")]);

  const anchorMonth = `${selectedYear}-01-01`;
  const months = useMemo(() => monthsForYear(anchorMonth), [anchorMonth]);

  const { data: rawPlanned, isLoading: lp } = useQuery({
    queryKey: ["planned-spreadsheet", projectId, months[0].key, months[11].key],
    queryFn: async (): Promise<PlannedRow[]> => {
      const { data, error } = await supabase
        .from("financial_planned_entries")
        .select("id, category_id, competence_month, planned_value, kind")
        .eq("project_id", projectId)
        .gte("competence_month", months[0].key)
        .lte("competence_month", months[11].key);
      if (error) throw error;
      return (data ?? []) as PlannedRow[];
    },
    enabled: !!projectId,
  });

  // Index existing rows by (categoryId, monthKey)
  const indexed = useMemo(() => {
    const map = new Map<string, PlannedRow>();
    (rawPlanned ?? []).forEach((r) => {
      if (!r.category_id) return;
      map.set(`${r.category_id}|${r.competence_month}`, r);
    });
    return map;
  }, [rawPlanned]);

  // Visible categories: only "cost"-type categories that are active.
  // Ordena pelo sort_order global (definido pela ordem da última importação de baseline)
  // e usa drg_group apenas como agrupamento visual — sem reordenar alfabeticamente.
  const visibleCategories = useMemo(
    () =>
      [...categories]
        .filter((c) => c.kind !== "revenue")
        .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code)),
    [categories],
  );

  const grouped = useMemo(() => {
    const g = new Map<string, CategoryRow[]>();
    visibleCategories.forEach((c) => {
      const key = c.drg_group ?? "Outros";
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(c);
    });
    return g;
  }, [visibleCategories]);

  const upsert = useMutation({
    mutationFn: async ({ categoryId, monthKey, value }: { categoryId: string; monthKey: string; value: number }) => {
      const existing = indexed.get(`${categoryId}|${monthKey}`);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      if (existing) {
        const { error } = await supabase
          .from("financial_planned_entries")
          .update({ planned_value: value })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_planned_entries").insert([
          {
            user_id: user.id,
            project_id: projectId,
            category_id: categoryId,
            competence_month: monthKey,
            planned_value: value,
            kind: "cost",
          },
        ]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planned-spreadsheet", projectId] });
      qc.invalidateQueries({ queryKey: ["financial-planned-entries"] });
    },
    onError: (e) => {
      toast({ title: "Erro ao salvar", description: (e as Error).message, variant: "destructive" });
    },
  });

  const getCellValue = (categoryId: string, monthKey: string): number => {
    const row = indexed.get(`${categoryId}|${monthKey}`);
    return row ? Number(row.planned_value) : 0;
  };

  const rowTotal = (categoryId: string): number => {
    return months.reduce((sum, m) => sum + getCellValue(categoryId, m.key), 0);
  };

  const colTotal = (monthKey: string): number => {
    return visibleCategories.reduce((sum, c) => sum + getCellValue(c.id, monthKey), 0);
  };

  const grandTotal = useMemo(
    () => visibleCategories.reduce((sum, c) => sum + rowTotal(c.id), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleCategories, rawPlanned],
  );

  if (lc || lp) return <Skeleton className="h-72" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Baseline editável — orçamento mensal por linha DRG</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <BudgetXlsxImporter projectId={projectId} />
            <Badge variant="outline" className="text-xs gap-1">
              <Pencil className="w-3 h-3" /> Clique para editar · Enter salva · Esc cancela
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Ano-base: {selectedYear} · {visibleCategories.length} linhas DRG · {grouped.size} grupos
        </p>
        {availableYears.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">
              Anos importados:
            </span>
            {availableYears.map((y) => (
              <Button
                key={y}
                size="sm"
                variant={y === selectedYear ? "default" : "outline"}
                onClick={() => setSelectedYear(y)}
                className="h-6 px-2 text-[11px]"
              >
                {y}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="sticky left-0 z-10 bg-muted/40 min-w-[260px]">Linha DRG</TableHead>
                {months.map((m) => (
                  <TableHead
                    key={m.key}
                    ref={focusCompetenceMonth === m.key ? focusRef : undefined}
                    className={cn(
                      "text-right text-[11px] uppercase tracking-wider min-w-[90px]",
                      focusCompetenceMonth === m.key && "bg-primary/10 text-primary",
                    )}
                  >
                    {m.label}
                  </TableHead>
                ))}
                <TableHead className="text-right text-[11px] uppercase tracking-wider sticky right-0 bg-muted/40 min-w-[110px]">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...grouped.entries()].map(([groupName, items]) => (
                <Fragment key={`grp-${groupName}`}>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableCell
                      colSpan={months.length + 2}
                      className="sticky left-0 bg-muted/20 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {groupName}
                    </TableCell>
                  </TableRow>
                  {items.map((cat) => (
                    <TableRow key={cat.id} className="group">
                      <TableCell className="sticky left-0 z-10 bg-background group-hover:bg-muted/40 text-xs">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-muted-foreground text-[10px]">{cat.code}</span>
                          <span className="truncate max-w-[180px]" title={cat.name}>
                            {cat.name}
                          </span>
                        </div>
                      </TableCell>
                      {months.map((m) => {
                        const isFocused = focusCompetenceMonth === m.key;
                        const value = getCellValue(cat.id, m.key);
                        return (
                          <TableCell
                            key={m.key}
                            className={cn("p-0 px-1", isFocused && "bg-primary/5")}
                          >
                            <EditableCell
                              value={value}
                              onCommit={(v) =>
                                upsert.mutate({
                                  categoryId: cat.id,
                                  monthKey: m.key,
                                  value: v,
                                })
                              }
                            />
                          </TableCell>
                        );
                      })}
                      <TableCell className="sticky right-0 bg-background group-hover:bg-muted/40 text-right tabular-nums text-xs font-medium">
                        {formatBRL(rowTotal(cat.id))}
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              ))}
              {/* Footer totals */}
              <TableRow className="bg-muted/40 font-semibold border-t-2">
                <TableCell className="sticky left-0 bg-muted/40 text-xs uppercase tracking-wider">
                  Total mensal
                </TableCell>
                {months.map((m) => (
                  <TableCell
                    key={m.key}
                    className={cn(
                      "text-right tabular-nums text-xs",
                      focusCompetenceMonth === m.key && "bg-primary/10 text-primary",
                    )}
                  >
                    {formatBRL(colTotal(m.key))}
                  </TableCell>
                ))}
                <TableCell className="sticky right-0 bg-muted/40 text-right tabular-nums text-xs">
                  {formatBRL(grandTotal)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        {visibleCategories.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma categoria DRG cadastrada. Cadastre categorias em <strong>Cadastros · Regras</strong> para
            começar a editar a baseline.
          </p>
        )}
        <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1.5">
          <Save className="w-3 h-3" /> Clique em qualquer célula para editar. <strong>Enter</strong> ou <strong>Tab</strong> salva, <strong>Esc</strong> cancela. Aceita formato BR (1.234,56) ou puro (1234.56).
        </p>
      </CardContent>
    </Card>
  );
};

export default PlannedSpreadsheet;
