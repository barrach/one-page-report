import { useState, useCallback, useMemo, useRef, useEffect, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@budget/integrations/supabase/client";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Input } from "@budget/components/ui/input";
import { Badge } from "@budget/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@budget/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Plus, Trash2, Users, BarChart3, Pencil, X, Check, Loader2, ChevronLeft, ChevronsRight } from "lucide-react";
import { Separator } from "@budget/components/ui/separator";
import { formatNumber } from "@budget/lib/format";
import { toast } from "sonner";
import {
  useWorkforceRows, useTimelinePhases, useWorkforceMutations, useTimelinePhaseMutations,
  computeScheduleIndicators, type WorkforceRow, type TimelinePhase, type RowType,
} from "@budget/hooks/useScheduleEngine";

const PHASE_COLORS = [
  "bg-muted", "bg-muted/80", "bg-muted/70", "bg-muted/60",
  "bg-muted/50", "bg-muted/40", "bg-muted/30", "bg-muted/20",
];

const MONTH_LABEL = (m: number) => `M${m + 1}`;
const WEEK_LABEL = (w: number) => `S${w + 1}`;

interface Props {
  scenarioId: string;
}

// ─── Helpers ────────────────────────────────────────────────────────
// WBS supports unlimited depth visually. The DB row_type is derived from the
// node's role in the tree: leaves = "function" (carry weekly values),
// internal nodes = "subgroup", and depth-1 nodes default to "group".
const RESOURCE_OPTIONS: ReadonlyArray<"MOD" | "MOI" | "ADM"> = ["MOD", "MOI", "ADM"];

const getNodeCode = (row: WorkforceRow) => row.row_code || row.id;

type WbsMeta = {
  depth: number;
  parentCode: string | null;
  path: number[];
  wbsId: string;
  isLeaf: boolean;
};

type WbsTree = {
  orderedRows: WorkforceRow[];
  metaById: Map<string, WbsMeta>;
};

const getRowTypeForNode = (level: number, isLeaf: boolean): RowType => {
  if (isLeaf) return "function";
  if (level <= 1) return "group";
  return "subgroup";
};

const getLevelFromRowType = (row: WorkforceRow) => {
  if (row.row_type === "group") return 1;
  if (row.row_type === "subgroup") return 2;
  return 3;
};

const sortRows = (items: WorkforceRow[]) => [...items].sort((a, b) => a.sort_order - b.sort_order);

function buildWbsTree(rows: WorkforceRow[]): WbsTree {
  const codeToRow = new Map(rows.map((row) => [getNodeCode(row), row]));
  const childrenByParent = new Map<string, WorkforceRow[]>();
  const roots: WorkforceRow[] = [];

  for (const row of rows) {
    const parentCode = row.parent_code;
    if (!parentCode || parentCode === getNodeCode(row) || !codeToRow.has(parentCode)) {
      roots.push(row);
      continue;
    }
    const siblings = childrenByParent.get(parentCode) || [];
    siblings.push(row);
    childrenByParent.set(parentCode, siblings);
  }

  const visited = new Set<string>();
  const orderedRows: WorkforceRow[] = [];
  const metaById = new Map<string, WbsMeta>();

  const visitSiblings = (siblings: WorkforceRow[], parentCode: string | null, parentPath: number[], depth: number) => {
    let siblingOrder = 0;
    const visitAsSibling = (row: WorkforceRow, normalizedParentCode: string | null, normalizedPath: number[], normalizedDepth: number) => {
      if (visited.has(row.id)) return;
      siblingOrder += 1;
      const path = [...normalizedPath, siblingOrder];
      visited.add(row.id);
      orderedRows.push(row);
      const rowCode = getNodeCode(row);
      const children = sortRows(childrenByParent.get(rowCode) || []);
      const isLeaf = children.length === 0;
      metaById.set(row.id, { depth: normalizedDepth, parentCode: normalizedParentCode, path, wbsId: path.join("."), isLeaf });
      visitSiblings(children, rowCode, path, normalizedDepth + 1);
    };

    for (const row of sortRows(siblings)) {
      visitAsSibling(row, parentCode, parentPath, depth);
    }
  };

  visitSiblings(roots, null, [], 1);

  const remaining = rows.filter((row) => !visited.has(row.id));
  visitSiblings(remaining, null, [], 1);

  return { orderedRows, metaById };
}

function buildHierarchicalIds(tree: WbsTree): Map<string, string> {
  const idMap = new Map<string, string>();
  tree.metaById.forEach((meta, rowId) => idMap.set(rowId, meta.wbsId));
  return idMap;
}

function computeRowSums(rows: WorkforceRow[], totalWeeks: number): Record<string, number[]> {
  const byCode = new Map(rows.map((row) => [getNodeCode(row), row]));
  const childrenByParent = new Map<string, WorkforceRow[]>();

  for (const row of rows) {
    if (!row.parent_code || !byCode.has(row.parent_code)) continue;
    const children = childrenByParent.get(row.parent_code) || [];
    children.push(row);
    childrenByParent.set(row.parent_code, children);
  }

  const sums: Record<string, number[]> = {};
  const visiting = new Set<string>();

  const sumNode = (row: WorkforceRow): number[] => {
    const code = getNodeCode(row);
    if (sums[code]) return sums[code];
    if (visiting.has(code)) return new Array(totalWeeks).fill(0);

    visiting.add(code);
    const total = new Array(totalWeeks).fill(0);
    const children = childrenByParent.get(code) || [];

    if (children.length === 0) {
      for (let w = 0; w < Math.min(row.weekly_values.length, totalWeeks); w++) {
        total[w] += row.weekly_values[w] || 0;
      }
    } else {
      for (const child of sortRows(children)) {
        const childSum = sumNode(child);
        for (let w = 0; w < totalWeeks; w++) total[w] += childSum[w] || 0;
      }
    }

    visiting.delete(code);
    sums[code] = total;
    return total;
  };

  rows.forEach(sumNode);
  return sums;
}

/** Derive real week count from actual data — never invent weeks */
function deriveWeeksFromData(rows: WorkforceRow[], phases: TimelinePhase[]): number {
  let maxFromRows = 0;
  for (const r of rows) {
    if (r.weekly_values.length > maxFromRows) maxFromRows = r.weekly_values.length;
  }
  let maxFromPhases = 0;
  for (const p of phases) {
    const end = p.start_week + p.duration_weeks;
    if (end > maxFromPhases) maxFromPhases = end;
  }
  return Math.max(maxFromRows, maxFromPhases);
}

// ─── Save status indicator ──────────────────────────────────────────
type SaveStatus = "idle" | "saving" | "saved" | "error";

const SaveIndicator = ({ status }: { status: SaveStatus }) => {
  if (status === "idle") return null;
  return (
    <div className="flex items-center gap-1.5 text-xs animate-fade-in">
      {status === "saving" && <><Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /><span className="text-muted-foreground">Salvando...</span></>}
      {status === "saved" && <><Check className="w-3 h-3 text-success" /><span className="text-success">Salvo</span></>}
      {status === "error" && <><X className="w-3 h-3 text-destructive" /><span className="text-destructive">Erro ao salvar</span></>}
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────────
const ScheduleSpreadsheet = ({ scenarioId }: Props) => {
  const { data: rows = [], isLoading: rowsLoading } = useWorkforceRows(scenarioId);
  const { data: phases = [], isLoading: phasesLoading } = useTimelinePhases(scenarioId);
  const { upsertRow, updateWeeklyValue, deleteRow, bulkInsert } = useWorkforceMutations(scenarioId);
  const { upsertPhase, deletePhase } = useTimelinePhaseMutations(scenarioId);
  const queryClient = useQueryClient();

  // Extra weeks the user manually added beyond data-derived count
  const [extraWeeks, setExtraWeeks] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string; weekIdx: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState("");
  const [editingSector, setEditingSector] = useState<string | null>(null);
  const [editSectorValue, setEditSectorValue] = useState("");
  const [blankDrafts, setBlankDrafts] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const committingBlankRowsRef = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dialogs
  const [addPhaseDialog, setAddPhaseDialog] = useState(false);
  const [newPhase, setNewPhase] = useState({ phase_name: "", start_week: 0, duration_weeks: 4 });
  const [editPhaseDialog, setEditPhaseDialog] = useState<TimelinePhase | null>(null);
  const [deletingWeek, setDeletingWeek] = useState(false);

  // ── Intelligent week count: derived from data + user extra ──
  // extraWeeks can be negative when the user explicitly shrinks the grid.
  const dataWeeks = useMemo(() => deriveWeeksFromData(rows, phases), [rows, phases]);
  const totalWeeks = Math.max(dataWeeks + extraWeeks, 0);

  const indicators = useMemo(() => computeScheduleIndicators(rows), [rows]);
  const months = Math.ceil(totalWeeks / 4);
  const wbsTree = useMemo(() => buildWbsTree(rows), [rows]);
  const hierarchicalIds = useMemo(() => buildHierarchicalIds(wbsTree), [wbsTree]);
  const wbsLevels = useMemo(() => {
    const levels = new Map<string, number>();
    wbsTree.metaById.forEach((meta, rowId) => levels.set(rowId, meta.depth));
    return levels;
  }, [wbsTree]);
  const normalizationSignature = useMemo(() => wbsTree.orderedRows
    .map((row, index) => {
      const meta = wbsTree.metaById.get(row.id);
      if (!meta) return "";
      const expectedType = getRowTypeForNode(meta.depth, meta.isLeaf);
      const expectedCode = expectedType === "function" ? null : getNodeCode(row);
      const expectedResource = expectedType === "function" ? (row.resource_type || "MOD") : null;
      const mustUpdate = row.sort_order !== index
        || row.row_type !== expectedType
        || row.parent_code !== meta.parentCode
        || row.row_code !== expectedCode
        || row.resource_type !== expectedResource;
      return mustUpdate ? `${row.id}:${index}:${expectedType}:${meta.parentCode ?? "root"}:${expectedCode ?? "fn"}` : "";
    })
    .filter(Boolean)
    .join("|"), [wbsTree]);
  const rowSums = useMemo(() => computeRowSums(rows, totalWeeks), [rows, totalWeeks]);
  const functionRows = rows.filter(r => r.row_type === "function" && Boolean(r.label?.trim()));
  const normalizedSignatureRef = useRef("");

  // ── Save status helper ──
  const showSaveStatus = useCallback((success: boolean) => {
    setSaveStatus(success ? "saved" : "error");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2500);
  }, []);

  // ── Cell editing ──
  const handleCellClick = (rowId: string, weekIdx: number, currentVal: number) => {
    setEditingCell({ rowId, weekIdx });
    setEditValue(String(currentVal || ""));
  };

  const handleCellBlur = () => {
    if (!editingCell) return;
    const newVal = parseInt(editValue) || 0;
    setSaveStatus("saving");
    updateWeeklyValue.mutate(
      { rowId: editingCell.rowId, weekIndex: editingCell.weekIdx, value: newVal },
      {
        onSuccess: () => showSaveStatus(true),
        onError: () => {
          showSaveStatus(false);
          toast.error("Falha ao salvar. Tente novamente.");
        },
      }
    );
    setEditingCell(null);
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCellBlur();
      if (editingCell) {
        const nextWeek = editingCell.weekIdx + 1;
        if (nextWeek < totalWeeks) {
          const row = rows.find(r => r.id === editingCell.rowId);
          if (row) {
            const nextVal = row.weekly_values[nextWeek] || 0;
            setTimeout(() => handleCellClick(editingCell.rowId, nextWeek, nextVal), 50);
          }
        }
      }
    }
    if (e.key === "Escape") setEditingCell(null);
    if (e.key === "Tab") {
      e.preventDefault();
      handleCellBlur();
    }
  };

  // ── Label editing ──
  const startEditLabel = (row: WorkforceRow) => {
    setEditingLabel(row.id);
    setEditLabelValue(row.label);
  };
  const saveLabel = (row: WorkforceRow) => {
    if (editLabelValue.trim() && editLabelValue !== row.label) {
      setSaveStatus("saving");
      upsertRow.mutate(
        { ...row, id: row.id, label: editLabelValue.trim() },
        { onSuccess: () => showSaveStatus(true), onError: () => showSaveStatus(false) }
      );
    }
    setEditingLabel(null);
  };

  // ── Inline updates for resource_type / sector ──
  const updateResourceType = async (row: WorkforceRow, value: "MOD" | "MOI" | "ADM") => {
    if (row.resource_type === value) return;
    setSaveStatus("saving");
    try {
      const { error } = await supabase
        .from("schedule_workforce")
        .update({ resource_type: value })
        .eq("id", row.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["schedule_workforce", scenarioId] });
      showSaveStatus(true);
    } catch {
      showSaveStatus(false);
      toast.error("Erro ao atualizar tipo.");
    }
  };

  const startEditSector = (row: WorkforceRow) => {
    setEditingSector(row.id);
    setEditSectorValue(row.sector || "");
  };
  const saveSector = async (row: WorkforceRow) => {
    const next = editSectorValue.trim() || null;
    setEditingSector(null);
    if ((row.sector || null) === next) return;
    setSaveStatus("saving");
    try {
      const { error } = await supabase
        .from("schedule_workforce")
        .update({ sector: next })
        .eq("id", row.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["schedule_workforce", scenarioId] });
      showSaveStatus(true);
    } catch {
      showSaveStatus(false);
      toast.error("Erro ao atualizar setor.");
    }
  };

  const normalizeTree = async (baseRows = rows) => {
    const tree = buildWbsTree(baseRows);
    await Promise.all(
      tree.orderedRows.map((row, index) => {
        const meta = tree.metaById.get(row.id);
        const level = meta?.depth || getLevelFromRowType(row);
        const isLeaf = meta?.isLeaf ?? (row.row_type === "function");
        const rowType = getRowTypeForNode(level, isLeaf);
        const patch = {
          sort_order: index,
          row_type: rowType,
          parent_code: meta?.parentCode ?? null,
          row_code: rowType === "function" ? null : getNodeCode(row),
          resource_type: rowType === "function" ? (row.resource_type || "MOD") : null,
        };
        return supabase.from("schedule_workforce").update(patch).eq("id", row.id);
      }),
    );
    await queryClient.invalidateQueries({ queryKey: ["schedule_workforce", scenarioId] });
  };

  useEffect(() => {
    if (rowsLoading || !normalizationSignature || normalizedSignatureRef.current === normalizationSignature) return;
    normalizedSignatureRef.current = normalizationSignature;
    setSaveStatus("saving");
    normalizeTree(rows)
      .then(() => showSaveStatus(true))
      .catch(() => showSaveStatus(false));
  }, [normalizationSignature, rowsLoading, rows]);

  // ── Create rows using stable database IDs only; visual index is never used as identity ──
  const quickAddRow = (
    type: RowType,
    parentCode: string | null,
    label = "Novo item",
    options?: { onSuccess?: () => void; onError?: () => void; sortOrder?: number },
  ) => {
    const maxSort = Math.max(...rows.map(r => r.sort_order), -1) + 1;
    const rowCode = type === "function" ? null : `code_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    upsertRow.mutate(
      {
        label,
        row_type: type,
        resource_type: type === "function" ? "MOD" : null,
        sector: null,
        parent_code: parentCode,
        row_code: rowCode,
        weekly_values: [],
        sort_order: options?.sortOrder ?? maxSort,
      },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: ["schedule_workforce", scenarioId] });
          options?.onSuccess?.();
          showSaveStatus(true);
        },
        onError: () => { options?.onError?.(); showSaveStatus(false); },
      },
    );
  };

  const getBlankRowKey = (blankIndex: number) => `blank-${visibleRows.length}-${blankIndex}`;

  const commitBlankRow = (blankKey: string, options?: { focusNextKey?: string }) => {
    const label = blankDrafts[blankKey]?.trim();
    if (!label || committingBlankRowsRef.current.has(blankKey)) return;
    committingBlankRowsRef.current.add(blankKey);
    setSaveStatus("saving");
    quickAddRow("group", null, label, {
      sortOrder: rows.length + Number(blankKey.split("-").pop() || 0),
      onSuccess: () => {
        committingBlankRowsRef.current.delete(blankKey);
        setBlankDrafts(prev => {
          const next = { ...prev };
          delete next[blankKey];
          return next;
        });
        if (options?.focusNextKey) {
          requestAnimationFrame(() => {
            document.querySelector<HTMLInputElement>(`[data-blank-row-key="${options.focusNextKey}"]`)?.focus();
          });
        }
      },
      onError: () => committingBlankRowsRef.current.delete(blankKey),
    });
  };

  // ── Add a sibling row below the last visible row, same level ──
  // ── Indent / Outdent (MS Project style) ──
  const indentRow = async (row: WorkforceRow) => {
    const ordered = wbsTree.orderedRows;
    const idx = ordered.findIndex((item) => item.id === row.id);
    const previous = idx > 0 ? ordered[idx - 1] : null;
    if (!previous) {
      toast.error("Não há item anterior no mesmo nível para receber esta tarefa.");
      return;
    }
    const previousLevel = wbsLevels.get(previous.id) || getLevelFromRowType(previous);
    const newLevel = previousLevel + 1;
    const parent = previous;
    const parentCode = parent.row_code || `code_${Date.now()}_p`;
    // Indented row becomes a leaf under its new parent → "function".
    const newType: RowType = "function";
    const nextRows = rows.map((item) => {
      if (item.id === parent.id) return { ...item, row_code: parentCode };
      if (item.id === row.id) {
        return {
          ...item,
          row_type: newType,
          parent_code: parentCode,
          row_code: newType === "function" ? null : (item.row_code || `code_${Date.now()}_i`),
          resource_type: newType === "function" ? (item.resource_type || "MOD") : null,
        };
      }
      return item;
    });
    setSaveStatus("saving");
    try {
      if (!parent.row_code) await supabase.from("schedule_workforce").update({ row_code: parentCode }).eq("id", parent.id);
      const updatedRow = nextRows.find((item) => item.id === row.id);
      await supabase.from("schedule_workforce").update({
        row_type: newType,
        parent_code: parentCode,
        row_code: newType === "function" ? null : updatedRow?.row_code,
        resource_type: newType === "function" ? (row.resource_type || "MOD") : null,
      }).eq("id", row.id);
      await normalizeTree(nextRows as WorkforceRow[]);
      showSaveStatus(true);
    } catch {
      showSaveStatus(false);
      toast.error("Erro ao recalcular a hierarquia.");
    }
  };

  const outdentRow = async (row: WorkforceRow) => {
    const currentLevel = wbsLevels.get(row.id) || getLevelFromRowType(row);
    if (currentLevel <= 1) {
      toast.error("Já está no nível mais alto.");
      return;
    }
    const parent = rows.find((item) => getNodeCode(item) === row.parent_code);
    const grandparent = parent?.parent_code ? rows.find((item) => getNodeCode(item) === parent.parent_code) : null;
    const newLevel = currentLevel - 1;
    const childCount = rows.filter((item) => item.parent_code === getNodeCode(row)).length;
    const newType: RowType = childCount > 0 ? (newLevel <= 1 ? "group" : "subgroup") : "function";
    const newParent = newLevel === 1 ? null : grandparent ? getNodeCode(grandparent) : null;
    const rowCode = newType === "function" ? null : (row.row_code || `code_${Date.now()}_o`);
    const nextRows = rows.map((item) => item.id === row.id ? {
      ...item,
      row_type: newType,
      parent_code: newParent,
      row_code: rowCode,
      resource_type: newType === "function" ? (item.resource_type || "MOD") : null,
    } : item);
    setSaveStatus("saving");
    try {
      await supabase.from("schedule_workforce").update({
        row_type: newType,
        parent_code: newParent,
        row_code: rowCode,
        resource_type: newType === "function" ? (row.resource_type || "MOD") : null,
      }).eq("id", row.id);
      await normalizeTree(nextRows as WorkforceRow[]);
      showSaveStatus(true);
    } catch {
      showSaveStatus(false);
      toast.error("Erro ao recalcular a hierarquia.");
    }
  };

  // ── Add phase ──
  const handleAddPhase = () => {
    const maxSort = Math.max(...phases.map(p => p.sort_order), -1) + 1;
    upsertPhase.mutate({
      phase_name: newPhase.phase_name,
      start_week: newPhase.start_week,
      duration_weeks: newPhase.duration_weeks,
      color_token: PHASE_COLORS[maxSort % PHASE_COLORS.length],
      sort_order: maxSort,
    });
    setAddPhaseDialog(false);
    setNewPhase({ phase_name: "", start_week: 0, duration_weeks: 4 });
  };

  const handleEditPhase = () => {
    if (!editPhaseDialog) return;
    upsertPhase.mutate(editPhaseDialog);
    setEditPhaseDialog(null);
  };

  const addWeeks = async (count: number) => {
    if (count >= 0) {
      setExtraWeeks(prev => prev + count);
      return;
    }

    // Reducing weeks: compute target total and trim from the end
    const removeCount = Math.min(-count, totalWeeks);
    if (removeCount <= 0) return;
    const newTotal = totalWeeks - removeCount;

    // Warn if data or phases will be lost
    const hasDataInRange = rows.some(r =>
      r.row_type === "function" &&
      r.weekly_values.slice(newTotal).some(v => Number(v) > 0)
    );
    const phaseAffected = phases.some(p => p.start_week + p.duration_weeks > newTotal);
    if (hasDataInRange || phaseAffected) {
      if (!confirm(`Existem dados/fases nas ${removeCount} última(s) semana(s). Deseja continuar?`)) return;
    }

    setDeletingWeek(true);
    setSaveStatus("saving");
    try {
      // Trim weekly_values for every function row
      const fnRows = rows.filter(r => r.row_type === "function");
      for (const row of fnRows) {
        if (row.weekly_values.length > newTotal) {
          const newValues = row.weekly_values.slice(0, newTotal);
          await supabase
            .from("schedule_workforce")
            .update({ weekly_values: newValues })
            .eq("id", row.id);
        }
      }

      // Adjust or remove phases that fall outside the new range
      for (const phase of phases) {
        if (phase.start_week >= newTotal) {
          await supabase.from("schedule_timeline_phases").delete().eq("id", phase.id);
          continue;
        }
        const newDuration = Math.min(phase.duration_weeks, newTotal - phase.start_week);
        if (newDuration !== phase.duration_weeks) {
          await supabase
            .from("schedule_timeline_phases")
            .update({ duration_weeks: Math.max(newDuration, 1) })
            .eq("id", phase.id);
        }
      }

      // Recompute extraWeeks against the (possibly new) dataWeeks
      setExtraWeeks(newTotal - dataWeeks);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["schedule_workforce", scenarioId] }),
        queryClient.invalidateQueries({ queryKey: ["schedule_timeline_phases", scenarioId] }),
      ]);
      showSaveStatus(true);
    } catch (err) {
      showSaveStatus(false);
      toast.error("Erro ao remover semanas.");
    } finally {
      setDeletingWeek(false);
    }
  };

  // ── Delete a specific week column ──


  const handleDeleteWeek = async (weekIndex: number) => {
    // Check if any row has data in this week
    const hasDataInWeek = rows.some(
      r => r.row_type === "function" && (r.weekly_values[weekIndex] || 0) > 0
    );
    if (hasDataInWeek) {
      if (!confirm(`Semana ${WEEK_LABEL(weekIndex)} contém dados. Deseja excluir? Essa ação não pode ser desfeita.`)) return;
    }

    setDeletingWeek(true);
    setSaveStatus("saving");

    try {
      const resultingWeeks = Math.max(totalWeeks - 1, 0);

      // Update all function rows: splice out the week
      const fnRows = rows.filter(r => r.row_type === "function");
      for (const row of fnRows) {
        const newValues = [...row.weekly_values];
        if (weekIndex < newValues.length) {
          newValues.splice(weekIndex, 1);
        }
        await supabase
          .from("schedule_workforce")
          .update({ weekly_values: newValues })
          .eq("id", row.id);
      }

      // Adjust phases or remove them if no weeks remain
      for (const phase of phases) {
        if (resultingWeeks === 0) {
          await supabase.from("schedule_timeline_phases").delete().eq("id", phase.id);
          continue;
        }

        const phaseEnd = phase.start_week + phase.duration_weeks;
        let newStart = phase.start_week;
        let newDuration = phase.duration_weeks;

        if (weekIndex < phase.start_week) {
          newStart = Math.max(phase.start_week - 1, 0);
        } else if (weekIndex >= phase.start_week && weekIndex < phaseEnd) {
          newDuration = phase.duration_weeks - 1;
        }

        if (newDuration <= 0) {
          await supabase.from("schedule_timeline_phases").delete().eq("id", phase.id);
          continue;
        }

        if (newStart + newDuration > resultingWeeks) {
          newDuration = Math.max(resultingWeeks - newStart, 1);
        }

        if (newStart !== phase.start_week || newDuration !== phase.duration_weeks) {
          await supabase
            .from("schedule_timeline_phases")
            .update({ start_week: newStart, duration_weeks: newDuration })
            .eq("id", phase.id);
        }
      }

      setExtraWeeks(resultingWeeks - dataWeeks);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["schedule_workforce", scenarioId] }),
        queryClient.invalidateQueries({ queryKey: ["schedule_timeline_phases", scenarioId] }),
      ]);

      showSaveStatus(true);
    } catch (err) {
      showSaveStatus(false);
      toast.error("Erro ao excluir semana.");
    } finally {
      setDeletingWeek(false);
    }
  };

  // ── Visible rows ──
  const visibleRows = useMemo(() => wbsTree.orderedRows, [wbsTree]);
  const blankRowCount = Math.max(12, 24 - visibleRows.length);
  const blankRows = useMemo(
    () => Array.from({ length: blankRowCount }, (_, index) => ({
      key: `blank-${visibleRows.length}-${index}`,
      visualNumber: visibleRows.length + index + 1,
      index,
    })),
    [blankRowCount, visibleRows.length],
  );

  const getWeekValues = (row: WorkforceRow): number[] => {
    const code = row.row_code || row.id;
    return rowSums[code] || row.weekly_values || [];
  };

  const CELL_W = 52;
  const ID_W = 56;
  const FUNC_W = 160;
  const TIPO_W = 56;
  const SETOR_W = 80;
  const FIXED_W = ID_W + FUNC_W + TIPO_W + SETOR_W; // total left columns
  const TOTAL_W = 64;

  // Color rules: level 1 = darker blue title, level 2 = lighter blue subtitle,
  // levels 3+ = plain card background.
  const getRowBg = (level: number) => {
    if (level === 1) return "bg-schedule-level1";
    if (level === 2) return "bg-schedule-level2";
    return "bg-card";
  };

  const getRowClasses = (level: number) => {
    if (level === 1) return "bg-schedule-level1 text-schedule-level1-foreground font-bold uppercase text-[11px] tracking-wide";
    if (level === 2) return "bg-schedule-level2 text-schedule-level2-foreground font-semibold text-[11px]";
    return "bg-card text-foreground text-[11px] hover:bg-muted/20";
  };

  const getRowTextClass = (level: number) => level === 1 ? "text-schedule-level1-foreground" : level === 2 ? "text-schedule-level2-foreground" : "text-muted-foreground";

  const getIndent = (level: number) => Math.max(level - 1, 0) * 16;


  // ── Duration source label ──
  const durationSource = useMemo(() => {
    if (dataWeeks === 0 && extraWeeks === 0) return null;
    if (dataWeeks > 0 && extraWeeks === 0) return "dados reais";
    if (dataWeeks > 0 && extraWeeks > 0) return `dados reais + ${extraWeeks} extras`;
    return "adicionadas manualmente";
  }, [dataWeeks, extraWeeks]);

  return (
    <div className="space-y-4 max-w-full">
      {/* ── Indicators ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">HH Total</p>
          {indicators.totalHH > 0 ? (
            <>
              <p className="text-xl font-bold font-mono text-foreground">{formatNumber(indicators.totalHH)}</p>
              <p className="text-[10px] text-muted-foreground">MOD: {formatNumber(indicators.modHH)} | MOI: {formatNumber(indicators.moiHH)}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Pendente</p>
          )}
        </Card>
        <Card className="p-3 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pico Efetivo</p>
          {indicators.peakEffective > 0 ? (
            <p className="text-xl font-bold font-mono text-accent">{indicators.peakEffective}</p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Pendente</p>
          )}
        </Card>
        <Card className="p-3 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Duração</p>
          {totalWeeks > 0 ? (
            <>
              <p className="text-xl font-bold font-mono text-foreground">{totalWeeks} sem</p>
              <p className="text-[10px] text-muted-foreground">
                {months} {months === 1 ? "mês" : "meses"} • {durationSource}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Não definida</p>
          )}
        </Card>
        <Card className="p-3 bg-card border-border">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Funções</p>
          {functionRows.length > 0 ? (
            <p className="text-xl font-bold font-mono text-foreground">{functionRows.length}</p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Nenhuma</p>
          )}
        </Card>
      </div>

      {/* ── Timeline phases ── */}
      <Card className="p-3 bg-card border-border">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-foreground">Fases da Timeline</h4>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setAddPhaseDialog(true)}>
            <Plus className="w-3 h-3" /> Fase
          </Button>
        </div>
        {phases.length > 0 && totalWeeks > 0 ? (
          <div className="relative h-10 bg-muted/30 rounded overflow-hidden">
            {phases.map((phase, idx) => (
              <div
                key={phase.id}
                className={`absolute h-full ${PHASE_COLORS[idx % PHASE_COLORS.length]} opacity-80 rounded flex items-center justify-center px-1 group cursor-pointer`}
                style={{
                  left: `${(phase.start_week / totalWeeks) * 100}%`,
                  width: `${Math.max((phase.duration_weeks / totalWeeks) * 100, 5)}%`,
                }}
                title={`${phase.phase_name} (S${phase.start_week + 1}–S${phase.start_week + phase.duration_weeks}, ${phase.duration_weeks * 7}d)`}
                onClick={() => setEditPhaseDialog(phase)}
              >
                            <span className="text-[9px] font-medium text-muted-foreground truncate">
                  {phase.phase_name} ({phase.duration_weeks * 7}d)
                </span>
                <button
                  className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full items-center justify-center text-destructive-foreground text-[8px] hidden group-hover:flex"
                  onClick={(e) => { e.stopPropagation(); deletePhase.mutate(phase.id); }}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            {phases.length > 0 ? "Adicione semanas para visualizar as fases." : "Nenhuma fase definida."}
          </p>
        )}
      </Card>

      {/* ── MS Project–style command bar ── */}
      <Card className="p-2 bg-card border-border">
        <div className="flex items-center gap-1 flex-wrap">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs gap-1"
              onClick={() => {
                const sel = rows.find(r => r.id === selectedRowId);
                if (!sel) { toast.error("Selecione uma tarefa preenchida."); return; }
                outdentRow(sel);
              }}
              disabled={!selectedRowId || (selectedRowId ? (wbsLevels.get(selectedRowId) || 1) <= 1 : true)}
              title="Recuar tarefa para a esquerda"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Recuar esquerda
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs gap-1"
              onClick={() => {
                const sel = rows.find(r => r.id === selectedRowId);
                if (!sel) { toast.error("Selecione uma tarefa preenchida."); return; }
                indentRow(sel);
              }}
              disabled={!selectedRowId}
              title="Recuar tarefa para a direita"
            >
              <ChevronsRight className="w-3.5 h-3.5" /> Recuar direita
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={() => {
                const sel = rows.find(r => r.id === selectedRowId);
                if (!sel) { toast.error("Selecione uma tarefa preenchida."); return; }
                const code = sel.row_code || sel.id;
                const isGroup = sel.row_type === "group" || sel.row_type === "subgroup";
                if (isGroup) {
                  const childCount = rows.filter(r => r.parent_code === code).length;
                  if (childCount > 0 && !confirm(`Excluir "${sel.label || "linha"}" e todos os ${childCount} itens?`)) return;
                }
                deleteRow.mutate(sel.id);
                setSelectedRowId(null);
              }}
              disabled={!selectedRowId || !rows.some(r => r.id === selectedRowId)}
              title="Excluir linha selecionada"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <div className="flex items-center gap-0.5">
            <span className="text-[10px] text-muted-foreground mr-1">Semanas:</span>
            <Button variant="ghost" size="sm" className="text-xs h-8 px-2" onClick={() => addWeeks(1)} disabled={deletingWeek}>+1</Button>
            <Button variant="ghost" size="sm" className="text-xs h-8 px-2" onClick={() => addWeeks(4)} disabled={deletingWeek}>+4</Button>
            <Button variant="ghost" size="sm" className="text-xs h-8 px-2" onClick={() => addWeeks(-4)} disabled={deletingWeek || totalWeeks <= 0}>−4</Button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {selectedRowId && rows.some(r => r.id === selectedRowId) && (
              <span className="text-[10px] text-muted-foreground hidden md:inline">
                Linha selecionada: <span className="font-mono text-foreground">{hierarchicalIds.get(selectedRowId) || "—"}</span>
              </span>
            )}
            <SaveIndicator status={saveStatus} />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
          Preencha as linhas em branco diretamente na grade; selecione uma linha preenchida e use os recuos para organizar a hierarquia.
        </p>
      </Card>

      {/* ── Spreadsheet — ALWAYS rendered, header visible even empty ── */}
      {(
        <Card className="bg-card border-border overflow-hidden">
          <div
            className="overflow-x-auto overflow-y-auto scrollbar-subtle"
            ref={scrollRef}
            style={{ maxHeight: "70vh" }}
          >
            <table
              className="text-xs border-collapse w-full"
              style={{ minWidth: FIXED_W + totalWeeks * CELL_W + TOTAL_W }}
            >
              <thead className="sticky top-0 z-30">
                {/* Row 1: Fixed column headers + Month groups + HORAS */}
                <tr className="border-b border-border bg-[hsl(var(--muted))]">
                  <th className="sticky left-0 z-40 bg-[hsl(var(--muted))] text-center p-1 font-semibold text-muted-foreground border-r border-border/50 text-[10px]" style={{ width: ID_W, minWidth: ID_W }}>ID</th>
                  <th className="sticky z-40 bg-[hsl(var(--muted))] text-left p-1 font-semibold text-muted-foreground border-r border-border/50 text-[10px]" style={{ left: ID_W, width: FUNC_W, minWidth: FUNC_W }}>FUNÇÃO</th>
                  <th className="sticky z-40 bg-[hsl(var(--muted))] text-center p-1 font-semibold text-muted-foreground border-r border-border/50 text-[10px]" style={{ left: ID_W + FUNC_W, width: TIPO_W, minWidth: TIPO_W }}>TIPO</th>
                  <th className="sticky z-40 bg-[hsl(var(--muted))] text-center p-1 font-semibold text-muted-foreground border-r border-border text-[10px]" style={{ left: ID_W + FUNC_W + TIPO_W, width: SETOR_W, minWidth: SETOR_W, boxShadow: "2px 0 4px rgba(0,0,0,0.15)" }}>SETOR</th>
                  {Array.from({ length: months }).map((_, m) => {
                    const colsInMonth = Math.min(4, totalWeeks - m * 4);
                    return (
                      <th
                        key={m}
                        colSpan={colsInMonth}
                        className="text-center p-1 font-semibold border-l border-border text-foreground text-[10px] bg-[hsl(var(--muted))]"
                      >
                        Mês {String(m + 1).padStart(2, "0")}
                      </th>
                    );
                  })}
                  <th
                    className="sticky right-0 z-40 bg-[hsl(var(--muted))] text-center p-1 font-semibold text-muted-foreground border-l border-border text-[10px]"
                    style={{ width: TOTAL_W, minWidth: TOTAL_W, boxShadow: "-2px 0 4px rgba(0,0,0,0.15)" }}
                  >
                    HORAS
                  </th>
                </tr>
                {/* Row 2: Empty fixed cols + Week labels */}
                <tr className="border-b border-border bg-[hsl(var(--muted))]">
                  <th className="sticky left-0 z-40 bg-[hsl(var(--muted))] border-r border-border/50" style={{ width: ID_W, minWidth: ID_W }} />
                  <th className="sticky z-40 bg-[hsl(var(--muted))] border-r border-border/50" style={{ left: ID_W, width: FUNC_W, minWidth: FUNC_W }} />
                  <th className="sticky z-40 bg-[hsl(var(--muted))] border-r border-border/50" style={{ left: ID_W + FUNC_W, width: TIPO_W, minWidth: TIPO_W }} />
                  <th className="sticky z-40 bg-[hsl(var(--muted))] border-r border-border" style={{ left: ID_W + FUNC_W + TIPO_W, width: SETOR_W, minWidth: SETOR_W, boxShadow: "2px 0 4px rgba(0,0,0,0.15)" }} />
                  {Array.from({ length: totalWeeks }).map((_, w) => (
                    <th
                      key={w}
                      className={`text-center p-1 font-normal text-muted-foreground text-[10px] relative ${w % 4 === 0 ? "border-l border-border" : "border-l border-border/20"}`}
                      style={{ width: CELL_W, minWidth: CELL_W, overflow: "visible" }}
                    >
                      <span className="relative inline-flex items-center gap-0.5 group/week">
                        {WEEK_LABEL(w)}
                        {totalWeeks > 0 && !deletingWeek && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteWeek(w); }}
                            className="w-3.5 h-3.5 rounded-full bg-destructive/80 hover:bg-destructive items-center justify-center text-destructive-foreground opacity-0 group-hover/week:opacity-100 transition-opacity inline-flex shrink-0"
                            title={`Excluir ${WEEK_LABEL(w)}`}
                          >
                            <X className="w-2 h-2" />
                          </button>
                        )}
                      </span>
                    </th>
                  ))}
                  <th
                    className="sticky right-0 z-40 bg-[hsl(var(--muted))] border-l border-border"
                    style={{ width: TOTAL_W, minWidth: TOTAL_W, boxShadow: "-2px 0 4px rgba(0,0,0,0.15)" }}
                  />
                </tr>
                {/* Row 3: Phase highlight — only if phases exist */}
                {phases.length > 0 && (
                  <tr className="border-b border-border bg-[hsl(var(--muted))]">
                    <th className="sticky left-0 z-40 bg-[hsl(var(--muted))] border-r border-border/50" style={{ width: ID_W, minWidth: ID_W }} />
                    <th className="sticky z-40 bg-[hsl(var(--muted))] text-left p-0.5 text-[9px] text-muted-foreground border-r border-border/50" style={{ left: ID_W, width: FUNC_W, minWidth: FUNC_W }}>Fases</th>
                    <th className="sticky z-40 bg-[hsl(var(--muted))] border-r border-border/50" style={{ left: ID_W + FUNC_W, width: TIPO_W, minWidth: TIPO_W }} />
                    <th className="sticky z-40 bg-[hsl(var(--muted))] border-r border-border" style={{ left: ID_W + FUNC_W + TIPO_W, width: SETOR_W, minWidth: SETOR_W, boxShadow: "2px 0 4px rgba(0,0,0,0.15)" }} />
                    {Array.from({ length: totalWeeks }).map((_, w) => {
                      const activePhase = phases.find(p => w >= p.start_week && w < p.start_week + p.duration_weeks);
                      const borderCls = w % 4 === 0 ? "border-l border-border" : "border-l border-border/20";
                      return (
                        <th
                          key={w}
                          className={`p-0 h-5 ${borderCls} ${activePhase ? "bg-muted/60" : ""}`}
                          style={{ width: CELL_W, minWidth: CELL_W }}
                          title={activePhase?.phase_name || ""}
                        >
                          {activePhase && w === activePhase.start_week && (
                            <span className="text-[7px] text-muted-foreground font-medium truncate px-0.5">{activePhase.phase_name}</span>
                          )}
                        </th>
                      );
                    })}
                    <th
                      className="sticky right-0 z-40 bg-[hsl(var(--muted))] border-l border-border"
                      style={{ width: TOTAL_W, minWidth: TOTAL_W, boxShadow: "-2px 0 4px rgba(0,0,0,0.15)" }}
                    />
                  </tr>
                )}
              </thead>
              <tbody>
                {(rowsLoading || phasesLoading) && (
                  <tr>
                    <td colSpan={5 + totalWeeks} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Carregando...
                    </td>
                  </tr>
                )}
                {visibleRows.map(row => {
                  const weekVals = getWeekValues(row);
                  const rowTotal = weekVals.reduce((s, v) => s + (v || 0), 0);
                  const isEditable = row.row_type === "function";
                  const isGroup = row.row_type === "group" || row.row_type === "subgroup";
                  const code = row.row_code || row.id;
                  const isCollapsed = collapsedGroups.has(code);
                  const hId = hierarchicalIds.get(row.id) || "";
                  const level = wbsLevels.get(row.id) || getLevelFromRowType(row);
                  const stickyBg = getRowBg(level);
                  const rowTextClass = getRowTextClass(level);

                  return (
                    <tr
                      key={row.id}
                      data-row-id={row.id}
                      onClick={() => setSelectedRowId(row.id)}
                      className={`border-b border-border/20 group/row cursor-pointer ${getRowClasses(level)} ${selectedRowId === row.id ? "ring-1 ring-inset ring-border" : ""}`}
                    >
                      {/* ID cell — sticky col 1 */}
                      <td
                        className={`sticky left-0 z-20 text-center p-1 whitespace-nowrap border-r border-border/50 font-mono text-[10px] ${stickyBg}`}
                        style={{ width: ID_W, minWidth: ID_W }}
                      >
                        {hId && <span className={rowTextClass}>{hId}</span>}
                      </td>
                      {/* FUNÇÃO cell — sticky col 2 */}
                      <td
                        className={`sticky z-20 p-1 whitespace-nowrap border-r border-border/50 ${stickyBg}`}
                        style={{ left: ID_W, width: FUNC_W, minWidth: FUNC_W, maxWidth: FUNC_W }}
                      >
                        <div className="flex items-center gap-1" style={{ paddingLeft: getIndent(level) }}>
                          {editingLabel === row.id ? (
                            <input
                              className="flex-1 bg-background border border-border rounded px-1 py-0.5 text-xs text-foreground outline-none min-w-0"
                              value={editLabelValue}
                              onChange={e => setEditLabelValue(e.target.value)}
                              onBlur={() => saveLabel(row)}
                              onKeyDown={e => { if (e.key === "Enter") saveLabel(row); if (e.key === "Escape") setEditingLabel(null); }}
                              autoFocus
                            />
                          ) : (
                            <span className="truncate flex-1 min-w-0" title={row.label}>{row.label}</span>
                          )}
                          <div className="flex items-center gap-0.5 ml-auto shrink-0 opacity-0 group-hover/row:opacity-100">
                            <button
                              onClick={(e) => { e.stopPropagation(); startEditLabel(row); }}
                              className="p-0.5 text-muted-foreground hover:text-foreground"
                              title="Editar nome"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isGroup) {
                                  const childCount = rows.filter(r => r.parent_code === code).length;
                                  if (childCount > 0 && !confirm(`Excluir "${row.label}" e todos os ${childCount} itens?`)) return;
                                }
                                deleteRow.mutate(row.id);
                                if (selectedRowId === row.id) setSelectedRowId(null);
                              }}
                              className="p-0.5 text-muted-foreground hover:text-destructive"
                              title="Excluir"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>
                      {/* TIPO cell — sticky col 3 */}
                      <td
                        className={`sticky z-20 text-center p-1 whitespace-nowrap border-r border-border/50 text-[9px] ${stickyBg}`}
                        style={{ left: ID_W + FUNC_W, width: TIPO_W, minWidth: TIPO_W }}
                      >
                        <Select
                          value={(row.resource_type === "MOD" || row.resource_type === "MOI" || row.resource_type === "ADM") ? row.resource_type : ""}
                          onValueChange={(value) => updateResourceType(row, value as "MOD" | "MOI" | "ADM")}
                        >
                          <SelectTrigger
                            className="h-6 px-1 py-0 text-[9px] font-semibold border-none bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:hidden justify-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent className="min-w-[80px]">
                            {RESOURCE_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt} className="text-xs">
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      {/* SETOR cell — sticky col 4 */}
                      <td
                        className={`sticky z-20 p-0 whitespace-nowrap border-r border-border text-[9px] text-muted-foreground ${stickyBg}`}
                        style={{ left: ID_W + FUNC_W + TIPO_W, width: SETOR_W, minWidth: SETOR_W, boxShadow: "2px 0 4px rgba(0,0,0,0.1)" }}
                        onClick={(e) => { e.stopPropagation(); startEditSector(row); }}
                      >
                        {editingSector === row.id ? (
                          <input
                            className="w-full h-7 bg-background border border-border rounded px-1 text-[10px] text-foreground outline-none text-center"
                            value={editSectorValue}
                            onChange={(e) => setEditSectorValue(e.target.value)}
                            onBlur={() => saveSector(row)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveSector(row);
                              if (e.key === "Escape") setEditingSector(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <div className="w-full h-7 flex items-center justify-center px-1 text-center cursor-text">
                            {row.sector || <span className="text-muted-foreground/30">—</span>}
                          </div>
                        )}
                      </td>

                      {/* Weekly cells */}
                      {Array.from({ length: totalWeeks }).map((_, w) => {
                        const val = weekVals[w] || 0;
                        const isEditing = editingCell?.rowId === row.id && editingCell?.weekIdx === w;
                        const borderCls = w % 4 === 0 ? "border-l border-border" : "border-l border-border/20";

                        return (
                          <td
                            key={w}
                            className={`text-center p-0 ${borderCls} ${isEditable ? "cursor-pointer hover:bg-muted/30" : ""}`}
                            style={{ width: CELL_W, minWidth: CELL_W }}
                            onClick={() => isEditable && handleCellClick(row.id, w, val)}
                          >
                            {isEditing ? (
                              <input
                                type="number"
                            className="w-full h-full p-1 text-center bg-muted border-none outline-none text-foreground text-xs font-mono"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={handleCellKeyDown}
                                autoFocus
                              />
                            ) : (
                              <span className={`font-mono text-[10px] ${val > 0 ? (isGroup ? "font-semibold text-foreground" : "text-foreground") : "text-muted-foreground/20"}`}>
                                {val > 0 ? val : isEditable ? "·" : ""}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Row total — sticky right */}
                      <td
                        className={`sticky right-0 z-20 text-center p-1 font-mono border-l border-border ${isGroup ? "font-bold" : "font-semibold"} ${stickyBg}`}
                        style={{ width: TOTAL_W, minWidth: TOTAL_W, boxShadow: "-2px 0 4px rgba(0,0,0,0.1)" }}
                      >
                        {rowTotal > 0 ? rowTotal : ""}
                      </td>
                    </tr>
                  );
                })}

                {blankRows.map((blankRow) => {
                  const nextBlankKey = getBlankRowKey(blankRow.index + 1);
                  return (
                  <tr
                    key={blankRow.key}
                    data-blank-row-key={blankRow.key}
                    className="border-b border-border/20 bg-card/60 hover:bg-muted/20"
                  >
                    <td
                      className="sticky left-0 z-20 text-center p-1 whitespace-nowrap border-r border-border/50 font-mono text-[10px] bg-card/60 text-muted-foreground/40"
                      style={{ width: ID_W, minWidth: ID_W }}
                    >
                      {blankRow.visualNumber}
                    </td>
                    <td
                      className="sticky z-20 p-0 border-r border-border/50 bg-card/60"
                      style={{ left: ID_W, width: FUNC_W, minWidth: FUNC_W, maxWidth: FUNC_W }}
                    >
                      <input
                        data-blank-row-key={blankRow.key}
                        className="w-full h-7 bg-transparent px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/40"
                        value={blankDrafts[blankRow.key] || ""}
                        placeholder="Digite uma tarefa..."
                        onChange={e => setBlankDrafts(prev => ({ ...prev, [blankRow.key]: e.target.value }))}
                        onBlur={() => commitBlankRow(blankRow.key)}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitBlankRow(blankRow.key, { focusNextKey: nextBlankKey });
                          }
                        }}
                      />
                    </td>
                    <td
                      className="sticky z-20 text-center p-1 whitespace-nowrap border-r border-border/50 text-[9px] bg-card/60"
                      style={{ left: ID_W + FUNC_W, width: TIPO_W, minWidth: TIPO_W }}
                    />
                    <td
                      className="sticky z-20 text-center p-1 whitespace-nowrap border-r border-border text-[9px] bg-card/60"
                      style={{ left: ID_W + FUNC_W + TIPO_W, width: SETOR_W, minWidth: SETOR_W, boxShadow: "2px 0 4px rgba(0,0,0,0.1)" }}
                    />
                    {Array.from({ length: totalWeeks }).map((_, w) => (
                      <td
                        key={w}
                        className={`text-center p-0 ${w % 4 === 0 ? "border-l border-border" : "border-l border-border/20"}`}
                        style={{ width: CELL_W, minWidth: CELL_W }}
                      />
                    ))}
                    <td
                      className="sticky right-0 z-20 text-center p-1 border-l border-border bg-card/60"
                      style={{ width: TOTAL_W, minWidth: TOTAL_W, boxShadow: "-2px 0 4px rgba(0,0,0,0.1)" }}
                    />
                  </tr>
                  );
                })}

                {/* ── Weekly totals footer ── */}
                {visibleRows.length > 0 && (
                  <tr className="border-t-2 border-border bg-muted/60 font-bold text-[11px] sticky bottom-0 z-20">
                    <td className="sticky left-0 z-30 bg-muted/60 p-1.5 border-r border-border/50" style={{ width: ID_W, minWidth: ID_W }} />
                    <td className="sticky z-30 bg-muted/60 p-1.5 border-r border-border/50" style={{ left: ID_W, width: FUNC_W, minWidth: FUNC_W }}>
                      <div className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3 text-muted-foreground" />
                        <span>EQUIPE TOTAL</span>
                      </div>
                    </td>
                    <td className="sticky z-30 bg-muted/60 border-r border-border/50" style={{ left: ID_W + FUNC_W, width: TIPO_W, minWidth: TIPO_W }} />
                    <td className="sticky z-30 bg-muted/60 border-r border-border" style={{ left: ID_W + FUNC_W + TIPO_W, width: SETOR_W, minWidth: SETOR_W, boxShadow: "2px 0 4px rgba(0,0,0,0.1)" }} />
                    {Array.from({ length: totalWeeks }).map((_, w) => {
                      const total = indicators.weeklyTotals[w] || 0;
                      return (
                        <td key={w} className={`text-center p-1 font-mono text-[10px] ${w % 4 === 0 ? "border-l border-border" : "border-l border-border/20"}`}>
                          {total > 0 ? total : ""}
                        </td>
                      );
                    })}
                    <td
                      className="sticky right-0 z-30 bg-muted/60 text-center p-1.5 font-mono border-l border-border"
                      style={{ width: TOTAL_W, minWidth: TOTAL_W, boxShadow: "-2px 0 4px rgba(0,0,0,0.1)" }}
                    >
                      {indicators.weeklyTotals.reduce((s, v) => s + v, 0) || ""}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Histogram ── */}
      {totalWeeks > 0 && indicators.peakEffective > 0 && (
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" /> Histograma de Efetivo
          </h3>
          <div className="overflow-x-auto scrollbar-subtle pb-2">
            <div className="flex items-end gap-1 h-36" style={{ minWidth: totalWeeks * 32 }}>
              {Array.from({ length: totalWeeks }).map((_, w) => {
                const mod = indicators.weeklyMOD[w] || 0;
                const moi = indicators.weeklyMOI[w] || 0;
                const total = mod + moi;
                const maxH = indicators.peakEffective || 1;
                return (
                  <div key={w} className="flex flex-col items-center gap-0.5 flex-1 min-w-[24px]">
                    <div className="w-full flex flex-col justify-end" style={{ height: 110 }}>
                      <div className="w-full bg-muted/50 rounded-t" style={{ height: `${(moi / maxH) * 100}%`, minHeight: moi > 0 ? 2 : 0 }} />
                      <div className="w-full bg-muted-foreground rounded-t" style={{ height: `${(mod / maxH) * 100}%`, minHeight: mod > 0 ? 2 : 0 }} />
                    </div>
                    <span className="text-[8px] text-muted-foreground">{WEEK_LABEL(w)}</span>
                    {total > 0 && <span className="text-[9px] font-mono text-foreground">{total}</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-6 mt-2 text-xs">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-muted-foreground" /><span className="text-muted-foreground">MOD</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-muted/50" /><span className="text-muted-foreground">MOI</span></div>
          </div>
        </Card>
      )}

      {/* ── Add Phase Dialog ── */}
      <Dialog open={addPhaseDialog} onOpenChange={setAddPhaseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Adicionar Fase</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Nome da Fase</label>
              <Input value={newPhase.phase_name} onChange={e => setNewPhase({ ...newPhase, phase_name: e.target.value })} placeholder="Ex: Mobilização" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Semana Início</label>
                <Input type="number" min={0} value={newPhase.start_week} onChange={e => setNewPhase({ ...newPhase, start_week: +e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Duração (semanas)</label>
                <Input type="number" min={1} value={newPhase.duration_weeks} onChange={e => setNewPhase({ ...newPhase, duration_weeks: +e.target.value })} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">= {newPhase.duration_weeks * 7} dias</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPhaseDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddPhase} disabled={!newPhase.phase_name}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Phase Dialog ── */}
      <Dialog open={!!editPhaseDialog} onOpenChange={() => setEditPhaseDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Fase</DialogTitle></DialogHeader>
          {editPhaseDialog && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Nome da Fase</label>
                <Input value={editPhaseDialog.phase_name} onChange={e => setEditPhaseDialog({ ...editPhaseDialog, phase_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Semana Início</label>
                  <Input type="number" min={0} value={editPhaseDialog.start_week} onChange={e => setEditPhaseDialog({ ...editPhaseDialog, start_week: +e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Duração (semanas)</label>
                  <Input type="number" min={1} value={editPhaseDialog.duration_weeks} onChange={e => setEditPhaseDialog({ ...editPhaseDialog, duration_weeks: +e.target.value })} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">= {editPhaseDialog.duration_weeks * 7} dias</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" size="sm" onClick={() => { deletePhase.mutate(editPhaseDialog!.id); setEditPhaseDialog(null); }}>Excluir</Button>
            <Button variant="outline" onClick={() => setEditPhaseDialog(null)}>Cancelar</Button>
            <Button onClick={handleEditPhase}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduleSpreadsheet;
