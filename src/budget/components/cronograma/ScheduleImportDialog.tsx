import { useState, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@budget/components/ui/dialog";
import { Button } from "@budget/components/ui/button";
import { Card } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Checkbox } from "@budget/components/ui/checkbox";
import { Input } from "@budget/components/ui/input";

import { Progress } from "@budget/components/ui/progress";
import { Upload, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle, ChevronRight, Info, Table2, Sparkles, Users, Wrench, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@budget/integrations/supabase/client";
import * as XLSX from "xlsx";
import {
  buildScheduleAnalysisPayloads,
  createWorksheetSnapshot,
  detectSheetType as detectWorksheetType,
  extractHistogramData,
  type WorksheetSnapshot,
} from "@budget/lib/scheduleImport";
import { parseScheduleHistogramSheet } from "@budget/lib/scheduleHistogramParser";
import { analyzeWorksheet, type DetectedBlock, type SheetAnalysis } from "@budget/lib/universalParser";
import BlockValidationStep from "@budget/components/import/BlockValidationStep";
import ImportSummaryPanel, { type ImportResult } from "@budget/components/import/ImportSummaryPanel";
import { useParserMemory, type PatternMatch } from "@budget/hooks/useParserMemory";

export interface ImportedPhase {
  phase_name: string;
  type: "phase" | "task" | "milestone";
  level: number;
  parent_index: number | null;
  start_day: number;
  duration_days: number;
  start_date: string | null;
  end_date: string | null;
  predecessors: string | null;
  resources: string | null;
  percent_complete: number | null;
  team_size: number;
  notes: string | null;
  is_summary: boolean;
  selected: boolean;
}

export interface ResourceDistribution {
  period: string;
  quantity: number;
}

export interface ImportedResource {
  resource_name: string;
  resource_type: "labor" | "equipment" | "vehicle";
  category: string;
  quantity: number;
  total: number;
  average: number;
  hours: number | null;
  unit: string | null;
  phase_name: string | null;
  period: string | null;
  notes: string | null;
  distribution: ResourceDistribution[];
}

export interface ImportedTotal {
  label: string;
  value: number;
  type: "total" | "subtotal" | "peak";
  original_row: number;
}

interface ImportSummary {
  total_lines_read: number;
  total_cronograma_lines: number;
  total_histograma_lines: number;
  total_phases: number;
  total_tasks: number;
  total_milestones: number;
  total_resources: number;
  total_summaries: number;
  unrecognized_count: number;
  quantity_fields_extracted: number;
  quantity_fields_unrecognized: number;
  missing_blocks: string[];
  interpreted_blocks: string[];
  periods: string[];
  warnings: string[];
}

interface SheetInfo {
  name: string;
  rowCount: number;
  suggested: boolean;
  suggestedLabel?: string;
}

export type ImportMode = "replace" | "merge" | "cancel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (phases: ImportedPhase[], resources?: ImportedResource[], mode?: ImportMode) => void;
  existingPhasesCount?: number;
}

type Step = "upload" | "select_sheet" | "validate_blocks" | "analyzing" | "preview" | "mpp_blocked" | "conflict" | "import_summary";
type AnalysisStep = "reading" | "sending" | "classifying" | "extracting" | "done" | "chunked";

const SCHEDULE_KEYWORDS = ["cronograma", "schedule", "gantt", "planejamento", "histograma", "planning", "timeline"];
const COST_KEYWORDS = ["custo", "cost", "preço", "pricing", "preços unitários"];

function detectSheetType(name: string): { suggested: boolean; label?: string } {
  const lower = name.toLowerCase();
  if (SCHEDULE_KEYWORDS.some(k => lower.includes(k))) {
    return { suggested: true, label: "Cronograma detectado" };
  }
  if (COST_KEYWORDS.some(k => lower.includes(k))) {
    return { suggested: false, label: "Parece conter custos" };
  }
  return { suggested: false };
}

const resourceTypeIcon = (t: string) => {
  if (t === "labor") return <Users className="w-3 h-3" />;
  if (t === "equipment") return <Wrench className="w-3 h-3" />;
  return <Truck className="w-3 h-3" />;
};

const resourceTypeLabel = (t: string) => {
  if (t === "labor") return "Mão de obra";
  if (t === "equipment") return "Equipamento";
  return "Veículo";
};

// Detect period columns in a worksheet (M1, M2, Mês 01, Semana 1, dates, etc.)
function detectPeriodColumns(ws: XLSX.WorkSheet): { startCol: number; periods: string[] } | null {
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const headerRow = range.s.r;
  const periods: string[] = [];
  let startCol = -1;

  const periodPatterns = [
    /^m[êe]?s?\s*\d/i, /^s\d/i, /^semana\s*\d/i, /^sem\s*\d/i,
    /^\d{1,2}\/\d{1,2}/i, /^jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez/i,
    /^M\d+/i, /^W\d+/i, /^week/i, /^month/i,
  ];

  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (!cell) continue;
    const val = String(cell.v || "").trim();
    if (val && periodPatterns.some(p => p.test(val))) {
      if (startCol === -1) startCol = c;
      periods.push(val);
    } else if (startCol !== -1 && periods.length > 0) {
      // Stop once we leave the period zone
      break;
    }
  }

  if (periods.length >= 2) {
    return { startCol, periods };
  }
  return null;
}

// Extract histogram distribution for resources from the worksheet
function extractHistogramFromSheet(
  ws: XLSX.WorkSheet,
  resourceNames: string[]
): Map<string, ResourceDistribution[]> {
  const result = new Map<string, ResourceDistribution[]>();
  const periodInfo = detectPeriodColumns(ws);
  if (!periodInfo || periodInfo.periods.length === 0) return result;

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const nameLower = resourceNames.map(n => n.toLowerCase().trim());

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    // Check first few columns for resource name
    let rowName = "";
    for (let c = range.s.c; c < Math.min(range.s.c + 3, periodInfo.startCol); c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v) {
        const v = String(cell.v).trim();
        if (v.length > 1) { rowName = v; break; }
      }
    }
    if (!rowName) continue;

    const rowNameLower = rowName.toLowerCase().trim();
    // Find matching resource
    const matchIdx = nameLower.findIndex(n => 
      rowNameLower.includes(n) || n.includes(rowNameLower) ||
      rowNameLower.replace(/\s+/g, "") === n.replace(/\s+/g, "")
    );
    if (matchIdx === -1) continue;

    const dist: ResourceDistribution[] = [];
    for (let i = 0; i < periodInfo.periods.length; i++) {
      const col = periodInfo.startCol + i;
      const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
      const qty = cell && typeof cell.v === "number" ? cell.v : 0;
      dist.push({ period: periodInfo.periods[i], quantity: qty });
    }

    if (dist.some(d => d.quantity > 0)) {
      result.set(resourceNames[matchIdx], dist);
    }
  }

  return result;
}

const ANALYSIS_STEPS: { key: AnalysisStep; label: string }[] = [
  { key: "reading", label: "Lendo arquivo..." },
  { key: "sending", label: "Enviando para análise..." },
  { key: "classifying", label: "Classificando tarefas e recursos..." },
  { key: "extracting", label: "Extraindo histograma..." },
  { key: "done", label: "Concluído!" },
];

// Sanitize phases: ensure all mandatory fields have valid values
function sanitizePhases(rawPhases: any[]): ImportedPhase[] {
  let runningDay = 0;
  return rawPhases
    .filter((p: any) => (p.phase_name || "").trim().length > 0)
    .map((p: any) => {
      const durationDays = typeof p.duration_days === "number" && p.duration_days >= 0 ? p.duration_days : 1;
      const teamSize = typeof p.team_size === "number" && p.team_size >= 0 ? p.team_size : 1;
      let startDay: number;
      if (typeof p.start_day === "number" && !isNaN(p.start_day)) {
        startDay = p.start_day;
      } else {
        startDay = runningDay;
      }
      runningDay = startDay + durationDays;
      return {
        ...p,
        phase_name: (p.phase_name || "").trim(),
        start_day: startDay,
        duration_days: durationDays,
        team_size: teamSize,
        selected: true,
      } as ImportedPhase;
    });
}
export default function ScheduleImportDialog({ open, onOpenChange, onImport, existingPhasesCount = 0 }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [phases, setPhases] = useState<ImportedPhase[]>([]);
  const [resources, setResources] = useState<ImportedResource[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [previewTab, setPreviewTab] = useState<"cronograma" | "recursos" | "resumo">("cronograma");
  const [totals, setTotals] = useState<ImportedTotal[]>([]);
  const [importMode, setImportMode] = useState<ImportMode>("replace");
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>("reading");
  const [chunkProgress, setChunkProgress] = useState({ current: 0, total: 0 });
  const [blockingIssues, setBlockingIssues] = useState<string[]>([]);
  const workbookRef = useRef<XLSX.WorkBook | null>(null);
  const sheetSnapshotsRef = useRef<Record<string, WorksheetSnapshot>>({});
  const abortRef = useRef(false);
  const sheetListRef = useRef<HTMLDivElement | null>(null);
  const [detectedBlocks, setDetectedBlocks] = useState<DetectedBlock[]>([]);
  const [sheetAnalysis, setSheetAnalysis] = useState<SheetAnalysis | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [patternMatches, setPatternMatches] = useState<Map<string, PatternMatch>>(new Map());
  const parserMemory = useParserMemory();

  const reset = () => {
    setStep("upload");
    setFileName("");
    setPhases([]);
    setResources([]);
    setSummary(null);
    setSheets([]);
    setSelectedSheets(new Set());
    setPreviewTab("cronograma");
    setTotals([]);
    setImportMode("replace");
    setAnalysisStep("reading");
    setChunkProgress({ current: 0, total: 0 });
    setBlockingIssues([]);
    setDetectedBlocks([]);
    setSheetAnalysis(null);
    setImportResult(null);
    workbookRef.current = null;
    sheetSnapshotsRef.current = {};
    abortRef.current = false;
  };

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow || "auto";
    };
  }, [open]);

  useEffect(() => {
    if (open && step === "select_sheet") {
      sheetListRef.current?.focus();
    }
  }, [open, step]);

  const handleClose = (v: boolean) => {
    if (!v) { abortRef.current = true; reset(); }
    onOpenChange(v);
  };

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const supported = ["xlsx", "xls", "csv", "mpp"];

    if (!supported.includes(ext)) {
      toast.error("Formato não suportado. Use .xlsx, .xls ou .csv");
      return;
    }

    if (ext === "mpp") {
      setFileName(file.name);
      setStep("mpp_blocked");
      return;
    }

    setFileName(file.name);

    if (ext === "csv") {
      setStep("analyzing");
      setAnalysisStep("reading");
      try {
        const content = await file.text();
        const MAX = 15000;
        const truncated = content.length > MAX
          ? content.substring(0, MAX) + "\n... [truncado]"
          : content;
        setAnalysisStep("sending");
        await analyzeContent(truncated, file.name);
      } catch (e: any) {
        console.error("Schedule import error:", e);
        toast.error(e.message || "Erro ao analisar o arquivo.");
        setStep("upload");
      }
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      workbookRef.current = wb;

      const snapshots = Object.fromEntries(
        wb.SheetNames.map((name) => [name, createWorksheetSnapshot(wb.Sheets[name], name)])
      ) as Record<string, WorksheetSnapshot>;
      sheetSnapshotsRef.current = snapshots;

      const sheetInfos: SheetInfo[] = wb.SheetNames.map(name => {
        const detection = detectWorksheetType(name);
        return {
          name,
          rowCount: snapshots[name]?.rowCount || 0,
          suggested: detection.suggested,
          suggestedLabel: detection.label,
        };
      });

      setSheets(sheetInfos);

      const autoSelected = new Set<string>();
      const preferredSheet = sheetInfos.find((sheet) => sheet.suggested) || sheetInfos[0];
      if (preferredSheet) autoSelected.add(preferredSheet.name);
      setSelectedSheets(autoSelected);

      if (sheetInfos.length === 1) {
        autoSelected.add(sheetInfos[0].name);
        setSelectedSheets(autoSelected);
        // Run universal parser for block validation
        const ws = wb.Sheets[sheetInfos[0].name];
        if (ws) {
          const analysis = analyzeWorksheet(ws, sheetInfos[0].name);
          setSheetAnalysis(analysis);
          setDetectedBlocks(analysis.blocks);
          setStep("validate_blocks");
        } else {
          processSelectedSheets(wb, autoSelected, file.name);
        }
      } else {
        setStep("select_sheet");
      }
    } catch (e: any) {
      console.error("Excel read error:", e);
      toast.error("Erro ao ler o arquivo Excel.");
      setStep("upload");
    }
  }, []);

  // Split CSV text into chunks of approximately maxChars each, splitting at line boundaries
  const splitIntoChunks = (text: string, maxChars: number): string[] => {
    const lines = text.split("\n");
    const chunks: string[] = [];
    let current = "";
    for (const line of lines) {
      if (current.length + line.length + 1 > maxChars && current.length > 0) {
        chunks.push(current);
        current = "";
      }
      current += (current ? "\n" : "") + line;
    }
    if (current.trim()) chunks.push(current);
    return chunks;
  };

  const processSelectedSheets = async (wb: XLSX.WorkBook, selected: Set<string>, fName: string) => {
    setStep("analyzing");
    setAnalysisStep("reading");
    abortRef.current = false;
    setBlockingIssues([]);

    try {
      if (selected.size !== 1) {
        throw new Error("Selecione apenas uma aba por vez. O MegaBudget não mistura dados de abas diferentes.");
      }

      const sheetName = Array.from(selected)[0];
      const ws = wb.Sheets[sheetName];
      if (!ws) {
        throw new Error("Não foi possível localizar a aba selecionada.");
      }

      // ─── Try specialized parser first for Megasteam-style sheets ───
      const isCronogramaHistograma = /cronograma|histograma/i.test(sheetName);
      if (isCronogramaHistograma) {
        try {
          setAnalysisStep("classifying");
          const parsed = parseScheduleHistogramSheet(ws, sheetName);
          
          if (parsed.recursos.length > 0 || parsed.fases.length > 0) {
            setAnalysisStep("extracting");

            // Convert fases to ImportedPhase
            const importedPhases: ImportedPhase[] = parsed.fases.map((f, i) => ({
              phase_name: f.name,
              type: "phase" as const,
              level: 0,
              parent_index: null,
              start_day: f.startWeek * 7,
              duration_days: f.durationDaysEstimate,
              start_date: null,
              end_date: null,
              predecessors: null,
              resources: null,
              percent_complete: null,
              team_size: 0,
              notes: null,
              is_summary: true,
              selected: true,
            }));

            // Also send cronograma to AI for WBS phase extraction
            const snapshot = sheetSnapshotsRef.current[sheetName] || createWorksheetSnapshot(ws, sheetName);
            sheetSnapshotsRef.current[sheetName] = snapshot;
            const payloads = buildScheduleAnalysisPayloads(snapshot, `${fName} — ${sheetName}`);
            
            let aiPhases: ImportedPhase[] = [];
            if (payloads.length > 0) {
              setAnalysisStep("sending");
              setChunkProgress({ current: 0, total: payloads.length });
              const aiRows: any[] = [];
              for (let i = 0; i < payloads.length; i++) {
                if (abortRef.current) return;
                setChunkProgress({ current: i + 1, total: payloads.length });
                const result = await analyzeChunk(payloads[i].fileContent, payloads[i].fileName, i + 1, payloads.length);
                aiRows.push(...(result?.phases || []));
              }
              aiPhases = sanitizePhases(aiRows);
            }

            // Merge: use AI phases for WBS structure, overlay with parsed timeline phases
            const allPhases = aiPhases.length > 0 ? aiPhases : importedPhases;
            
            // Enrich AI phases with team_size from parsed histogram links
            for (const phase of allPhases) {
              const matchingLinks = parsed.links.filter(l => 
                phase.phase_name.toLowerCase().includes(l.phase.toLowerCase()) ||
                l.phase.toLowerCase().includes(phase.phase_name.toLowerCase())
              );
              if (matchingLinks.length > 0) {
                const peakForPhase = Math.max(...matchingLinks.map(l => l.hh));
                phase.team_size = Math.max(phase.team_size, matchingLinks.length);
              }
            }

            // Convert recursos to ImportedResource
            const extractedResources: ImportedResource[] = parsed.recursos.map((r) => ({
              resource_name: r.funcao,
              resource_type: r.categoria === "equipamento" || r.categoria === "ferramenta" ? "equipment" as const : "labor" as const,
              category: r.categoria,
              quantity: r.quantidade_pico,
              total: r.hh_total,
              average: r.distribuicao_semanal.length > 0
                ? Math.round(r.distribuicao_semanal.reduce((a, b) => a + b, 0) / r.distribuicao_semanal.length * 10) / 10
                : 0,
              hours: r.hh_validado ?? r.hh_total,
              unit: r.categoria === "equipamento" ? "diária" : "HH",
              phase_name: r.grupo || null,
              period: null,
              notes: r.setor ? `Setor: ${r.setor}` : null,
              distribution: r.distribuicao_semanal.map((qty, idx) => ({
                period: parsed.timeline.periods[idx]?.week || `S${idx + 1}`,
                quantity: qty,
              })),
            }));

            // Build totals from groups
            const combinedTotals: ImportedTotal[] = parsed.grupos.map((g) => ({
              label: g.nome,
              value: g.hh_total,
              type: "subtotal" as const,
              original_row: g.original_row,
            }));

            const warnings: string[] = [...parsed.validacao.warnings];
            if (parsed.validacao.totais_recalculados) {
              warnings.push("Totais foram recalculados a partir dos dados base (fórmulas ignoradas).");
            }

            setPhases(allPhases);
            setResources(extractedResources);
            setTotals(combinedTotals);
            setBlockingIssues([]);
            setSummary({
              total_lines_read: parsed.validacao.linhas_lidas,
              total_cronograma_lines: parsed.fases.length,
              total_histograma_lines: parsed.validacao.linhas_validas,
              total_phases: allPhases.filter(p => p.type === "phase").length,
              total_tasks: allPhases.filter(p => p.type === "task").length,
              total_milestones: allPhases.filter(p => p.type === "milestone").length,
              total_resources: extractedResources.length,
              total_summaries: combinedTotals.length,
              unrecognized_count: 0,
              quantity_fields_extracted: parsed.recursos.reduce((s, r) => s + r.distribuicao_semanal.filter(v => v > 0).length, 0),
              quantity_fields_unrecognized: 0,
              missing_blocks: [],
              interpreted_blocks: ["cronograma", "histograma", "totais"].filter(b => 
                b === "cronograma" ? allPhases.length > 0 :
                b === "histograma" ? extractedResources.length > 0 :
                combinedTotals.length > 0
              ),
              periods: parsed.timeline.periods.map(p => `${p.month} ${p.week}`),
              warnings,
            });
            setAnalysisStep("done");
            setPreviewTab("cronograma");
            setStep("preview");
            
            console.log("[ScheduleImport] Specialized parser result:", {
              fases: parsed.fases.length,
              recursos: parsed.recursos.length,
              grupos: parsed.grupos.length,
              links: parsed.links.length,
              indicadores: parsed.indicadores,
            });
            return;
          }
        } catch (specialErr) {
          console.warn("[ScheduleImport] Specialized parser failed, falling back:", specialErr);
        }
      }

      // ─── Fallback: original flow with AI analysis + extractHistogramData ───
      const snapshot = sheetSnapshotsRef.current[sheetName] || createWorksheetSnapshot(ws, sheetName);
      sheetSnapshotsRef.current[sheetName] = snapshot;

      const payloads = buildScheduleAnalysisPayloads(snapshot, `${fName} — ${sheetName}`);
      if (payloads.length === 0) {
        throw new Error("Não foi possível localizar o bloco do cronograma na aba selecionada.");
      }

      const histogramExtract = extractHistogramData(snapshot);
      const importedRows: any[] = [];
      const aiWarnings = new Set<string>(histogramExtract.validation.warnings);
      const aiTotals: ImportedTotal[] = [];
      let aiUnrecognizedCount = 0;

      setChunkProgress({ current: 0, total: payloads.length });
      setAnalysisStep(payloads.length > 1 ? "chunked" : "sending");

      for (let i = 0; i < payloads.length; i++) {
        if (abortRef.current) return;
        setChunkProgress({ current: i + 1, total: payloads.length });

        const result = await analyzeChunk(payloads[i].fileContent, payloads[i].fileName, i + 1, payloads.length);
        importedRows.push(...(result?.phases || []));
        aiUnrecognizedCount += Number(result?.summary?.unrecognized_count || 0);
        (result?.summary?.warnings || []).forEach((warning: string) => aiWarnings.add(warning));
        (result?.totals || []).forEach((total: any) => {
          aiTotals.push({
            label: total.label || "",
            value: total.value ?? 0,
            type: total.type || "total",
            original_row: total.original_row || 0,
          });
        });
      }

      if (abortRef.current) return;

      setAnalysisStep("extracting");

      const importedPhases = sanitizePhases(importedRows);
      const extractedResources: ImportedResource[] = histogramExtract.resources.map((resource) => ({
        resource_name: resource.resource_name,
        resource_type: resource.resource_type,
        category: resource.category || "outro",
        quantity: resource.quantity ?? 0,
        total: resource.total ?? resource.quantity ?? 0,
        average: resource.average ?? 0,
        hours: resource.hours ?? null,
        unit: resource.unit,
        phase_name: resource.phase_name,
        period: resource.period,
        notes: resource.notes,
        distribution: resource.distribution.map((entry) => ({ period: entry.period, quantity: entry.quantity })),
      }));

      const combinedTotals = Array.from(
        new Map(
          [...aiTotals, ...histogramExtract.totals.map((total) => ({
            label: total.label,
            value: total.value ?? 0,
            type: total.type === "hours" ? "total" : total.type,
            original_row: total.original_row,
          }))].map((total) => [
            `${total.original_row}-${total.label.toLowerCase()}-${total.type}`,
            total,
          ])
        ).values()
      ).sort((a, b) => a.original_row - b.original_row);

      const blocking: string[] = [];
      const interpretedBlocks = new Set<string>(histogramExtract.validation.interpreted_blocks);
      const missingBlocks = new Set<string>(histogramExtract.validation.missing_blocks);

      if (snapshot.mergedCells > 0) {
        aiWarnings.add(`${snapshot.mergedCells} áreas mescladas foram consideradas na leitura estrutural da aba.`);
      }

      if (importedPhases.length > 0) interpretedBlocks.add("cronograma");
      if (snapshot.cronogramaRows.length > 0 && importedPhases.length === 0) {
        blocking.push("O bloco do cronograma não foi interpretado. Nenhuma fase ou tarefa foi identificada.");
        missingBlocks.add("cronograma");
      }
      if (snapshot.cronogramaRows.length >= 15 && importedPhases.length <= 2) {
        aiWarnings.add(`O cronograma original contém ${snapshot.cronogramaRows.length} linhas, mas apenas ${importedPhases.length} foram identificadas. Pode haver truncamento.`);
      }

      if (extractedResources.length > 0) interpretedBlocks.add("histograma");
      if ((snapshot.histogramaRows.length > 0 || /histograma/i.test(sheetName)) && extractedResources.length === 0) {
        aiWarnings.add("O bloco do histograma foi detectado mas nenhum recurso foi extraído. Os recursos podem ser adicionados manualmente.");
        missingBlocks.add("histograma");
      }
      if (snapshot.periodColumns.length > 0 && histogramExtract.validation.quantity_fields_extracted === 0) {
        aiWarnings.add("Os períodos do histograma foram localizados, mas as quantidades não foram extraídas. Verifique a aba original.");
      }

      if (combinedTotals.length > 0) interpretedBlocks.add("totais");
      if (snapshot.totalsRows.length > 0 && combinedTotals.length === 0) {
        missingBlocks.add("totais");
        aiWarnings.add("Foram detectadas linhas de totalização, mas elas precisam de revisão manual.");
      }

      blocking.forEach((issue) => aiWarnings.add(issue));

      setPhases(importedPhases);
      setResources(extractedResources);
      setTotals(combinedTotals);
      setBlockingIssues(blocking);
      setSummary({
        total_lines_read: snapshot.rowCount,
        total_cronograma_lines: snapshot.cronogramaRows.length,
        total_histograma_lines: snapshot.histogramaRows.length,
        total_phases: importedPhases.filter((phase) => phase.type === "phase").length,
        total_tasks: importedPhases.filter((phase) => phase.type === "task").length,
        total_milestones: importedPhases.filter((phase) => phase.type === "milestone").length,
        total_resources: extractedResources.length,
        total_summaries: combinedTotals.length,
        unrecognized_count: aiUnrecognizedCount + histogramExtract.validation.quantity_fields_unrecognized,
        quantity_fields_extracted: histogramExtract.validation.quantity_fields_extracted,
        quantity_fields_unrecognized: histogramExtract.validation.quantity_fields_unrecognized,
        missing_blocks: Array.from(missingBlocks),
        interpreted_blocks: Array.from(interpretedBlocks),
        periods: histogramExtract.validation.periods,
        warnings: Array.from(aiWarnings),
      });
      setAnalysisStep("done");
      setPreviewTab(blocking.length > 0 ? "resumo" : "cronograma");
      setStep("preview");
    } catch (e: any) {
      console.error("Schedule import error:", e);
      toast.error(e.message || "Erro ao analisar o arquivo.");
      setStep(sheets.length > 1 ? "select_sheet" : "upload");
    }
  };

  // Process a single chunk via edge function — returns parsed data or null
  const analyzeChunk = async (content: string, fName: string, chunkNum: number, totalChunks: number): Promise<any> => {
    const { data, error } = await supabase.functions.invoke("analyze-schedule-file", {
      body: { fileContent: content, fileName: `${fName} (bloco ${chunkNum}/${totalChunks})` },
    });
    if (error) {
      // Retry with smaller content
      const smaller = content.substring(0, Math.floor(content.length * 0.6));
      const { data: retryData, error: retryError } = await supabase.functions.invoke("analyze-schedule-file", {
        body: { fileContent: smaller + "\n... [truncado]", fileName: `${fName} (bloco ${chunkNum}/${totalChunks})` },
      });
      if (retryError) throw retryError;
      return retryData;
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  // Single-call analysis for small files
  const analyzeContent = async (content: string, fName: string, retryCount = 0) => {
    try {
      setAnalysisStep("classifying");
      const { data, error } = await supabase.functions.invoke("analyze-schedule-file", {
        body: { fileContent: content, fileName: fName },
      });

      if (error) {
        console.error("[ScheduleImport] Edge function error:", error);
        if (retryCount < 1) {
          console.log("[ScheduleImport] Retrying with smaller payload...");
          const smallerContent = content.substring(0, Math.floor(content.length * 0.5));
          toast.info("Reduzindo dados para nova tentativa...");
          return analyzeContent(smallerContent + "\n... [truncado]", fName, retryCount + 1);
        }
        throw new Error("Não foi possível processar o arquivo. Tente novamente ou selecione uma aba menor.");
      }

      if (data?.error) {
        if (data.error === "unsupported_format") {
          toast.error(data.message);
          setStep("upload");
          return;
        }
        throw new Error(data.error);
      }

      if (!data || (!data.phases && !data.resources)) {
        throw new Error("Resposta inesperada da análise. Tente novamente.");
      }

      setAnalysisStep("extracting");

      const importedPhases = sanitizePhases(data.phases || []);

      const aiResources: ImportedResource[] = (data.resources || []).map((r: any) => ({
        resource_name: r.resource_name || "",
        resource_type: r.resource_type || "labor",
        category: r.category || "outro",
        quantity: r.quantity || 0,
        total: r.total || r.quantity || 0,
        average: r.average || 0,
        hours: r.hours ?? null,
        unit: r.unit || null,
        phase_name: r.phase_name || null,
        period: r.period || null,
        notes: r.notes || null,
        distribution: [],
      }));

      if (workbookRef.current && aiResources.length > 0) {
        const wb = workbookRef.current;
        const resourceNames = aiResources.map(r => r.resource_name);
        for (const sheetName of Array.from(selectedSheets)) {
          const ws = wb.Sheets[sheetName];
          if (!ws) continue;
          const histMap = extractHistogramFromSheet(ws, resourceNames);
          for (const res of aiResources) {
            const dist = histMap.get(res.resource_name);
            if (dist && dist.length > 0) {
              res.distribution = dist;
              const quantities = dist.map(d => d.quantity).filter(q => q > 0);
              if (quantities.length > 0) {
                res.quantity = Math.max(...quantities);
                res.total = quantities.reduce((a, b) => a + b, 0);
                res.average = Math.round((res.total / quantities.length) * 10) / 10;
              }
            }
          }
        }
      }

      const aiTotals: ImportedTotal[] = (data.totals || []).map((t: any) => ({
        label: t.label || "",
        value: t.value || 0,
        type: t.type || "total",
        original_row: t.original_row || 0,
      }));

      setPhases(importedPhases);
      setResources(aiResources);
      setTotals(aiTotals);
      setBlockingIssues([]);
      setSummary({
        total_lines_read: data.summary?.total_lines_read ?? importedPhases.length + aiResources.length,
        total_cronograma_lines: data.summary?.total_cronograma_lines ?? importedPhases.length,
        total_histograma_lines: data.summary?.total_histograma_lines ?? aiResources.length,
        total_phases: data.summary?.total_phases ?? importedPhases.filter((p: ImportedPhase) => p.type === "phase").length,
        total_tasks: data.summary?.total_tasks ?? importedPhases.filter((p: ImportedPhase) => p.type === "task").length,
        total_milestones: data.summary?.total_milestones ?? importedPhases.filter((p: ImportedPhase) => p.type === "milestone").length,
        total_resources: data.summary?.total_resources ?? aiResources.length,
        total_summaries: data.summary?.total_summaries ?? aiTotals.length,
        unrecognized_count: data.summary?.unrecognized_count ?? 0,
        quantity_fields_extracted: data.summary?.quantity_fields_extracted ?? 0,
        quantity_fields_unrecognized: data.summary?.quantity_fields_unrecognized ?? 0,
        missing_blocks: data.summary?.missing_blocks ?? [],
        interpreted_blocks: data.summary?.interpreted_blocks ?? [importedPhases.length > 0 ? "cronograma" : "", aiResources.length > 0 ? "histograma" : ""].filter(Boolean),
        periods: data.summary?.periods ?? [],
        warnings: data.summary?.warnings ?? [],
      });
      setAnalysisStep("done");
      setPreviewTab("cronograma");
      setStep("preview");
    } catch (e: any) {
      console.error("[ScheduleImport] analyzeContent error:", e);
      toast.error(e.message || "Não foi possível processar o arquivo. Tente novamente.");
      setStep(sheets.length > 1 ? "select_sheet" : "upload");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const toggleSheet = (name: string) => {
    setSelectedSheets(prev => prev.has(name) && prev.size === 1 ? new Set() : new Set([name]));
  };

  const togglePhase = (index: number) => {
    setPhases(prev => prev.map((p, i) => i === index ? { ...p, selected: !p.selected } : p));
  };

  const toggleAll = (checked: boolean) => {
    setPhases(prev => prev.map(p => ({ ...p, selected: checked })));
  };

  const updatePhaseName = (index: number, name: string) => {
    setPhases(prev => prev.map((p, i) => i === index ? { ...p, phase_name: name } : p));
  };

  const updateTeamSize = (index: number, size: number) => {
    setPhases(prev => prev.map((p, i) => i === index ? { ...p, team_size: size } : p));
  };

  const updateDuration = (index: number, days: number) => {
    setPhases(prev => prev.map((p, i) => i === index ? { ...p, duration_days: days } : p));
  };

  const handleImport = () => {
    if (blockingIssues.length > 0) {
      toast.error("A importação ainda está incompleta. Revise os blocos pendentes antes de continuar.");
      setPreviewTab("resumo");
      return;
    }
    const selected = phases.filter(p => p.selected);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos uma fase para importar.");
      return;
    }
    if (existingPhasesCount > 0 && step === "preview") {
      setStep("conflict");
      return;
    }
    onImport(selected, resources, importMode);
    handleClose(false);
  };

  const handleConfirmConflict = () => {
    if (importMode === "cancel") {
      handleClose(false);
      return;
    }
    const selected = phases.filter(p => p.selected);
    onImport(selected, resources, importMode);
    handleClose(false);
  };

  const handleConfirmSheets = () => {
    if (selectedSheets.size === 0) {
      toast.error("Selecione a aba que deseja importar.");
      return;
    }
    if (selectedSheets.size > 1) {
      toast.error("Selecione apenas uma aba. O MegaBudget não mistura cronogramas de abas diferentes.");
      return;
    }
    if (!workbookRef.current) return;

    // Run universal parser to detect blocks before AI analysis
    const sheetName = Array.from(selectedSheets)[0];
    const ws = workbookRef.current.Sheets[sheetName];
    if (!ws) return;

    const analysis = analyzeWorksheet(ws, sheetName);
    // Apply learned patterns from memory
    const { blocks: enhancedBlocks, matches } = parserMemory.applyMemory(analysis.blocks);
    setSheetAnalysis(analysis);
    setDetectedBlocks(enhancedBlocks);
    setPatternMatches(matches);
    setStep("validate_blocks");
  };

  const handleUpdateBlock = (blockId: string, updates: Partial<DetectedBlock>) => {
    setDetectedBlocks(prev => {
      const old = prev.find(b => b.id === blockId);
      // Learn from correction if type changed
      if (old && updates.type && updates.type !== old.type) {
        parserMemory.learnFromCorrection(old, old.type, updates.type, fileName);
      }
      return prev.map(b => b.id === blockId ? { ...b, ...updates } : b);
    });
  };

  const handleConfirmAllBlocks = () => {
    setDetectedBlocks(prev => prev.map(b => ({ ...b, confirmed: true })));
    // Learn from all confirmed blocks
    detectedBlocks.filter(b => !b.ignored).forEach(b => {
      parserMemory.learnFromConfirmation(b, fileName);
    });
  };

  const handleProceedFromValidation = () => {
    const confirmedBlocks = detectedBlocks.filter(b => b.confirmed && !b.ignored);
    if (confirmedBlocks.length === 0) {
      toast.error("Confirme pelo menos um bloco para continuar.");
      return;
    }
    // Learn from all confirmed blocks
    confirmedBlocks.forEach(b => {
      parserMemory.learnFromConfirmation(b, fileName);
    });
    if (!workbookRef.current) return;
    processSelectedSheets(workbookRef.current, selectedSheets, fileName);
  };

  const selectedCount = phases.filter(p => p.selected).length;
  const allSelected = phases.length > 0 && selectedCount === phases.length;

  const typeLabel = (t: string) => {
    if (t === "phase") return "Fase";
    if (t === "milestone") return "Marco";
    return "Tarefa";
  };

  const typeBadgeVariant = (t: string): "default" | "secondary" | "outline" => {
    if (t === "phase") return "default";
    if (t === "milestone") return "outline";
    return "secondary";
  };

  const totalLabor = resources.filter(r => r.resource_type === "labor").reduce((s, r) => s + r.quantity, 0);
  const totalEquip = resources.filter(r => r.resource_type === "equipment").reduce((s, r) => s + r.quantity, 0);
  const totalVehicle = resources.filter(r => r.resource_type === "vehicle").reduce((s, r) => s + r.quantity, 0);
  const totalHH = resources.reduce((s, r) => s + (r.hours ?? 0), 0);
  const hasDistribution = resources.some(r => r.distribution && r.distribution.length > 0);

  // Group resources by category
  const categoryLabel = (cat: string) => {
    if (cat === "moi") return "Mão de Obra Indireta";
    if (cat === "mod") return "Mão de Obra Direta";
    if (cat === "equipamento") return "Ferramentas / Equipamentos";
    if (cat === "veiculo") return "Veículos";
    return "Outros";
  };

  const resourcesByCategory = resources.reduce((acc, r) => {
    const key = r.category || "outro";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {} as Record<string, ImportedResource[]>);

  const categoryOrder = ["moi", "mod", "equipamento", "veiculo", "outro"];
  const sortedCategories = Object.keys(resourcesByCategory).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Importar Cronograma
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div
            className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById("schedule-file-input")?.click()}
          >
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-foreground font-medium mb-1">
              Arraste um arquivo de cronograma ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground">
              Formatos aceitos: .xlsx, .xls, .csv — Exportado do MS Project também é aceito
            </p>
            <p className="text-[10px] text-muted-foreground mt-2">
              Arquivos .mpp devem ser exportados para Excel antes do upload
            </p>
            <input
              id="schedule-file-input"
              type="file"
              accept=".xlsx,.xls,.csv,.mpp"
              className="hidden"
              onChange={handleInputChange}
            />
          </div>
        )}

        {step === "select_sheet" && (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
             <div className="flex items-center gap-2 shrink-0">
              <Table2 className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">
                 Selecione a aba que deseja importar
              </p>
            </div>
              <p className="text-xs text-muted-foreground shrink-0">
               Arquivo: <span className="font-medium text-foreground">{fileName}</span> — escolha uma única aba para análise completa
             </p>
            <div
              ref={sheetListRef}
              tabIndex={0}
              className="min-h-0 flex-1 max-h-[60vh] overflow-y-auto overflow-x-hidden pr-2 pb-4 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md overscroll-contain scrollbar-subtle sm:max-h-[60vh] max-sm:max-h-[70vh]"
              aria-label="Lista de abas disponíveis para importação"
            >
              <div className="space-y-2 pr-1">
                {sheets.map((sheet) => (
                  <Card
                    key={sheet.name}
                    className={`p-3 cursor-pointer transition-colors border ${
                      selectedSheets.has(sheet.name)
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-card hover:border-primary/20"
                    }`}
                    onClick={() => toggleSheet(sheet.name)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedSheets.has(sheet.name)}
                        onCheckedChange={() => toggleSheet(sheet.name)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{sheet.name}</p>
                        <p className="text-[10px] text-muted-foreground">{sheet.rowCount} linhas</p>
                      </div>
                      {sheet.suggested && (
                        <Badge variant="default" className="text-[10px] gap-1 shrink-0">
                          <Sparkles className="w-3 h-3" />
                          {sheet.suggestedLabel || "Recomendada"}
                        </Badge>
                      )}
                      {sheet.suggestedLabel && !sheet.suggested && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {sheet.suggestedLabel}
                        </Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "validate_blocks" && sheetAnalysis && (
          <BlockValidationStep
            analysis={sheetAnalysis}
            blocks={detectedBlocks}
            onUpdateBlock={handleUpdateBlock}
            onConfirmAll={handleConfirmAllBlocks}
            fileName={fileName}
            patternMatches={patternMatches}
            autoMatchRate={parserMemory.autoMatchRate}
            patternCount={parserMemory.patternCount}
          />
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-6">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />

            {analysisStep === "chunked" && chunkProgress.total > 0 ? (
              <div className="w-full max-w-sm space-y-3">
                <p className="text-sm font-medium text-foreground text-center">
                  Processando em partes para evitar travamentos
                </p>
                <Progress value={(chunkProgress.current / chunkProgress.total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Processando bloco {chunkProgress.current} de {chunkProgress.total}
                </p>
                <p className="text-[10px] text-muted-foreground text-center">
                  A aba selecionada é grande e está sendo processada em etapas.
                </p>
              </div>
            ) : (
              <div className="w-full max-w-sm space-y-3">
                {ANALYSIS_STEPS.filter(s => s.key !== "chunked").map((s, i) => {
                  const filteredSteps = ANALYSIS_STEPS.filter(st => st.key !== "chunked");
                  const stepIdx = filteredSteps.findIndex(st => st.key === analysisStep);
                  return (
                    <div key={s.key} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        i < stepIdx ? "bg-primary text-primary-foreground" :
                        i === stepIdx ? "bg-primary/20 border-2 border-primary" :
                        "bg-muted border border-border"
                      }`}>
                        {i < stepIdx && <CheckCircle className="w-3 h-3" />}
                        {i === stepIdx && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                      </div>
                      <span className={`text-sm ${
                        i <= stepIdx ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <Button variant="outline" size="sm" className="mt-2" onClick={() => {
              abortRef.current = true;
              toast.info("Análise cancelada.");
              setStep(sheets.length > 1 ? "select_sheet" : "upload");
            }}>
              Cancelar
            </Button>
          </div>
        )}

        {step === "mpp_blocked" && (
          <div className="flex flex-col items-center py-8 gap-6">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-accent" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-foreground">
                Arquivos do MS Project (.mpp) não podem ser lidos diretamente
              </p>
              <p className="text-xs text-muted-foreground">
                Para importar seu cronograma, exporte o arquivo para Excel (.xlsx) ou CSV.
              </p>
            </div>
            <Card className="p-4 bg-muted/30 border-border max-w-md w-full">
              <p className="text-xs font-medium text-foreground mb-3">Como exportar do MS Project:</p>
              <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Abra o cronograma no <strong className="text-foreground">Microsoft Project</strong></li>
                <li>Vá em <strong className="text-foreground">Arquivo → Salvar como</strong></li>
                <li>Escolha o formato <strong className="text-foreground">Pasta de Trabalho do Excel (.xlsx)</strong> ou <strong className="text-foreground">CSV</strong></li>
                <li>Salve e faça upload do arquivo convertido aqui no MegaBudget</li>
              </ol>
            </Card>
            <Button variant="outline" onClick={() => setStep("upload")} className="gap-2">
              <Upload className="w-4 h-4" />
              Enviar arquivo Excel ou CSV
            </Button>
          </div>
        )}

        {step === "conflict" && (
          <div className="flex flex-col gap-4 py-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7 text-accent" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Este orçamento já possui {existingPhasesCount} {existingPhasesCount === 1 ? "fase" : "fases"} no cronograma
              </p>
              <p className="text-xs text-muted-foreground">
                O que deseja fazer com o cronograma atual?
              </p>
            </div>

            <div className="space-y-2">
              <Card
                className={`p-4 cursor-pointer transition-colors border ${
                  importMode === "replace" ? "border-destructive/50 bg-destructive/5" : "border-border hover:border-destructive/30"
                }`}
                onClick={() => setImportMode("replace")}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    importMode === "replace" ? "border-destructive" : "border-muted-foreground"
                  }`}>
                    {importMode === "replace" && <div className="w-2 h-2 rounded-full bg-destructive" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Substituir cronograma atual</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Apaga todas as fases, tarefas e recursos existentes. Importa o novo cronograma do zero.
                    </p>
                  </div>
                </div>
              </Card>

              <Card
                className={`p-4 cursor-pointer transition-colors border ${
                  importMode === "merge" ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
                }`}
                onClick={() => setImportMode("merge")}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    importMode === "merge" ? "border-primary" : "border-muted-foreground"
                  }`}>
                    {importMode === "merge" && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Mesclar com cronograma existente</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mantém as fases atuais e adiciona as novas fases importadas ao final.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {step === "preview" && summary && (
          <div className="flex flex-col flex-1 min-h-0 gap-2 overflow-hidden">
            <div className="shrink-0 space-y-2">
              {selectedSheets.size > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Abas processadas: {Array.from(selectedSheets).join(", ")}
                </p>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <div><span className="text-muted-foreground uppercase text-[10px]">Linhas </span><span className="font-bold font-mono text-foreground">{summary.total_lines_read}</span></div>
                <div><span className="text-muted-foreground uppercase text-[10px]">Crono </span><span className="font-bold font-mono text-foreground">{summary.total_cronograma_lines}</span></div>
                <div><span className="text-muted-foreground uppercase text-[10px]">Histo </span><span className="font-bold font-mono text-accent">{summary.total_histograma_lines}</span></div>
                <div><span className="text-muted-foreground uppercase text-[10px]">Fases </span><span className="font-bold font-mono text-primary">{summary.total_phases}</span></div>
                <div><span className="text-muted-foreground uppercase text-[10px]">Tarefas </span><span className="font-bold font-mono text-foreground">{summary.total_tasks}</span></div>
                <div><span className="text-muted-foreground uppercase text-[10px]">Recursos </span><span className="font-bold font-mono text-accent">{resources.length}</span></div>
                <div><span className="text-muted-foreground uppercase text-[10px]">Qtd </span><span className="font-bold font-mono text-foreground">{summary.quantity_fields_extracted}</span></div>
                <div><span className="text-muted-foreground uppercase text-[10px]">Selecionados </span><span className="font-bold font-mono text-primary">{selectedCount}</span></div>
              </div>

              {blockingIssues.length > 0 && (
                <Card className="p-3 bg-destructive/10 border-destructive/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">
                        A importação não pode ser concluída enquanto houver blocos pendentes.
                      </p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        {blockingIssues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              )}

              {summary.warnings && summary.warnings.length > 0 && (
                <Card className="p-3 bg-accent/10 border-accent/20">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Alguns dados não foram identificados automaticamente. Você pode revisar após a importação.
                    </p>
                  </div>
                </Card>
              )}

              <div className="flex gap-1 border-b border-border">
                <button
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                    previewTab === "cronograma"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setPreviewTab("cronograma")}
                >
                  Cronograma ({phases.length})
                </button>
                <button
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                    previewTab === "recursos"
                      ? "border-accent text-accent"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setPreviewTab("recursos")}
                >
                  Recursos / Histograma ({resources.length})
                </button>
                <button
                  className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                    previewTab === "resumo"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setPreviewTab("resumo")}
                >
                  Resumo / Validação
                </button>
              </div>

              {previewTab === "cronograma" && (
                <div className="flex items-center gap-2 px-1">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(c) => toggleAll(!!c)}
                  />
                  <span className="text-xs text-muted-foreground">Selecionar todos ({phases.length} itens)</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2 pb-4 overscroll-contain scrollbar-subtle">
              {previewTab === "cronograma" && (
                <div className="space-y-1 pr-3">
                  {phases.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">Nenhuma fase ou tarefa identificada.</p>
                    </div>
                  ) : (
                    phases.map((phase, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                          phase.selected ? "border-primary/30 bg-primary/5" : "border-border bg-card"
                        }`}
                        style={{ paddingLeft: `${12 + phase.level * 20}px` }}
                      >
                        <Checkbox
                          checked={phase.selected}
                          onCheckedChange={() => togglePhase(idx)}
                        />
                        {phase.level > 0 && (
                          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        )}
                        <Input
                          value={phase.phase_name}
                          onChange={(e) => updatePhaseName(idx, e.target.value)}
                          className="h-7 text-xs flex-1 min-w-0"
                        />
                        <Badge variant={typeBadgeVariant(phase.type)} className="text-[10px] shrink-0">
                          {typeLabel(phase.type)}
                        </Badge>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-muted-foreground">Dia</span>
                          <Input
                            type="number"
                            value={phase.start_day}
                            onChange={(e) => {
                              const v = +e.target.value;
                              setPhases(prev => prev.map((p, i) => i === idx ? { ...p, start_day: v } : p));
                            }}
                            className="h-7 w-14 text-xs text-center"
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-muted-foreground">Dur</span>
                          <Input
                            type="number"
                            value={phase.duration_days}
                            onChange={(e) => updateDuration(idx, +e.target.value)}
                            className="h-7 w-14 text-xs text-center"
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-muted-foreground">Eq</span>
                          <Input
                            type="number"
                            value={phase.team_size}
                            onChange={(e) => updateTeamSize(idx, +e.target.value)}
                            className="h-7 w-14 text-xs text-center"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {previewTab === "recursos" && (
                <div className="space-y-3 pr-3">
                  {resources.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">Nenhum recurso identificado no histograma.</p>
                      <p className="text-xs text-muted-foreground mt-1">Os recursos serão calculados a partir das fases importadas.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <Card className="p-2 bg-primary/5 border-primary/20">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            <div>
                              <p className="text-[10px] text-muted-foreground">Mão de obra (pico)</p>
                              <p className="text-sm font-bold text-foreground">{totalLabor}</p>
                            </div>
                          </div>
                        </Card>
                        <Card className="p-2 bg-accent/5 border-accent/20">
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-accent" />
                            <div>
                              <p className="text-[10px] text-muted-foreground">Equipamentos (pico)</p>
                              <p className="text-sm font-bold text-foreground">{totalEquip}</p>
                            </div>
                          </div>
                        </Card>
                        <Card className="p-2 bg-muted border-border">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-[10px] text-muted-foreground">Veículos (pico)</p>
                              <p className="text-sm font-bold text-foreground">{totalVehicle}</p>
                            </div>
                          </div>
                        </Card>
                        {totalHH > 0 && (
                          <Card className="p-2 bg-primary/5 border-primary/20">
                            <div>
                              <p className="text-[10px] text-muted-foreground">HH Total</p>
                              <p className="text-sm font-bold text-foreground">{totalHH.toLocaleString("pt-BR")}</p>
                            </div>
                          </Card>
                        )}
                      </div>

                      {hasDistribution && (
                        <Card className="p-2 bg-primary/5 border-primary/20">
                          <div className="flex items-center gap-2">
                            <Info className="w-3 h-3 text-primary" />
                            <p className="text-[10px] text-muted-foreground">
                              Histograma temporal detectado — quantidades distribuídas por período
                            </p>
                          </div>
                        </Card>
                      )}

                      {sortedCategories.map((cat) => (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center gap-2 py-1 px-1 border-b border-border">
                            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                              {categoryLabel(cat)}
                            </span>
                            <Badge variant="secondary" className="text-[10px]">
                              {resourcesByCategory[cat].length} recursos
                            </Badge>
                            {(() => {
                              const catHH = resourcesByCategory[cat].reduce((s, r) => s + (r.hours ?? 0), 0);
                              return catHH > 0 ? (
                                <Badge variant="outline" className="text-[10px]">
                                  {catHH.toLocaleString("pt-BR")} HH
                                </Badge>
                              ) : null;
                            })()}
                          </div>
                          {resourcesByCategory[cat].map((res, idx) => (
                            <div key={idx} className="rounded border border-border bg-card">
                              <div className="flex items-center gap-2 p-2">
                                <span className="shrink-0">{resourceTypeIcon(res.resource_type)}</span>
                                <span className="text-xs font-medium text-foreground flex-1 min-w-0 truncate">
                                  {res.resource_name}
                                </span>
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="text-right">
                                    <p className="text-[9px] text-muted-foreground">Pico</p>
                                    <p className="text-xs font-mono font-bold text-foreground">{res.quantity}</p>
                                  </div>
                                  {res.hours != null && res.hours > 0 && (
                                    <div className="text-right">
                                      <p className="text-[9px] text-muted-foreground">HH</p>
                                      <p className="text-xs font-mono text-foreground">{res.hours.toLocaleString("pt-BR")}</p>
                                    </div>
                                  )}
                                  {res.total > 0 && res.total !== res.quantity && !res.hours && (
                                    <div className="text-right">
                                      <p className="text-[9px] text-muted-foreground">Total</p>
                                      <p className="text-xs font-mono text-foreground">{res.total}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {res.distribution && res.distribution.length > 0 && (
                                <div className="px-2 pb-2">
                                  <div className="flex items-end gap-px h-8">
                                    {res.distribution.map((d, i) => {
                                      const maxQ = Math.max(...res.distribution.map(x => x.quantity), 1);
                                      const h = (d.quantity / maxQ) * 100;
                                      return (
                                        <div key={i} className="flex-1 flex flex-col items-center" title={`${d.period}: ${d.quantity}`}>
                                          <div
                                            className="w-full bg-primary/40 rounded-t-sm min-h-[1px]"
                                            style={{ height: `${Math.max(h, 3)}%` }}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="flex justify-between mt-0.5">
                                    <span className="text-[8px] text-muted-foreground">{res.distribution[0]?.period}</span>
                                    <span className="text-[8px] text-muted-foreground">{res.distribution[res.distribution.length - 1]?.period}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {previewTab === "resumo" && (
                <div className="space-y-4 pr-3">
                  <Card className="p-4 bg-card border-border space-y-3">
                    <p className="text-sm font-medium text-foreground">Validação da Importação</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between p-2 rounded bg-muted/30">
                        <span className="text-muted-foreground">Linhas lidas</span>
                        <span className="font-mono font-bold text-foreground">{summary?.total_lines_read || 0}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted/30">
                        <span className="text-muted-foreground">Linhas do cronograma</span>
                        <span className="font-mono font-bold text-foreground">{summary?.total_cronograma_lines || 0}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted/30">
                        <span className="text-muted-foreground">Linhas do histograma</span>
                        <span className="font-mono font-bold text-accent">{summary?.total_histograma_lines || 0}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted/30">
                        <span className="text-muted-foreground">Fases identificadas</span>
                        <span className="font-mono font-bold text-primary">{summary?.total_phases || 0}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted/30">
                        <span className="text-muted-foreground">Tarefas identificadas</span>
                        <span className="font-mono font-bold text-foreground">{summary?.total_tasks || 0}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted/30">
                        <span className="text-muted-foreground">Totais / subtotais</span>
                        <span className="font-mono font-bold text-foreground">{summary?.total_summaries || 0}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted/30">
                        <span className="text-muted-foreground">Recursos identificados</span>
                        <span className="font-mono font-bold text-accent">{resources.length}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted/30">
                        <span className="text-muted-foreground">HH Total</span>
                        <span className="font-mono font-bold text-primary">{totalHH > 0 ? totalHH.toLocaleString("pt-BR") : "—"}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted/30">
                        <span className="text-muted-foreground">Pico de efetivo</span>
                        <span className="font-mono font-bold text-foreground">{totalLabor + totalEquip + totalVehicle}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted/30">
                        <span className="text-muted-foreground">Quantidades extraídas</span>
                        <span className="font-mono font-bold text-foreground">{summary?.quantity_fields_extracted || 0}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded bg-muted/30">
                        <span className="text-muted-foreground">Não reconhecidos</span>
                        <span className={`font-mono font-bold ${(summary?.unrecognized_count || 0) > 0 ? "text-destructive" : "text-foreground"}`}>
                          {summary?.unrecognized_count || 0}
                        </span>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4 bg-card border-border space-y-3">
                    <p className="text-sm font-medium text-foreground">Blocos interpretados</p>
                    <div className="flex flex-wrap gap-2">
                      {summary?.interpreted_blocks?.length ? summary.interpreted_blocks.map((block) => (
                        <Badge key={block} variant="default" className="text-[10px]">{block}</Badge>
                      )) : <span className="text-xs text-muted-foreground">Nenhum bloco validado ainda.</span>}
                    </div>
                    {summary?.missing_blocks?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">Blocos pendentes</p>
                        <div className="flex flex-wrap gap-2">
                          {summary.missing_blocks.map((block) => (
                            <Badge key={block} variant="outline" className="text-[10px] border-destructive/30 text-destructive">{block}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {summary?.periods?.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Períodos detectados: <span className="text-foreground">{summary.periods.join(", ")}</span>
                      </p>
                    )}
                  </Card>

                  {resources.length > 0 && (
                    <Card className="p-4 bg-card border-border space-y-2">
                      <p className="text-sm font-medium text-foreground">Resumo de Recursos</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="p-2 rounded bg-primary/5 border border-primary/20 text-center">
                          <p className="text-muted-foreground text-[10px]">Mão de obra</p>
                          <p className="font-mono font-bold text-foreground">{resources.filter(r => r.resource_type === "labor").length}</p>
                        </div>
                        <div className="p-2 rounded bg-accent/5 border border-accent/20 text-center">
                          <p className="text-muted-foreground text-[10px]">Equipamentos</p>
                          <p className="font-mono font-bold text-foreground">{resources.filter(r => r.resource_type === "equipment").length}</p>
                        </div>
                        <div className="p-2 rounded bg-muted border border-border text-center">
                          <p className="text-muted-foreground text-[10px]">Veículos</p>
                          <p className="font-mono font-bold text-foreground">{resources.filter(r => r.resource_type === "vehicle").length}</p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>Pico total de mão de obra: <span className="font-mono font-bold text-foreground">{totalLabor}</span> pessoas</p>
                        {resources.some(r => r.distribution.length > 0) && (
                          <p className="mt-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-primary" />
                            Histograma temporal detectado com distribuição por período
                          </p>
                        )}
                      </div>
                    </Card>
                  )}

                  {totals.length > 0 && (
                    <Card className="p-4 bg-card border-border space-y-2">
                      <p className="text-sm font-medium text-foreground">Totais Importados</p>
                      <div className="space-y-1">
                        {totals.map((t, i) => (
                          <div key={i} className="flex justify-between items-center p-2 rounded bg-muted/30 text-xs">
                            <span className="text-muted-foreground">{t.label}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px]">{t.type}</Badge>
                              <span className="font-mono font-bold text-foreground">{t.value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {summary?.warnings && summary.warnings.length > 0 && (
                    <Card className="p-4 bg-accent/10 border-accent/20 space-y-2">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-accent" />
                        Observações
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        {summary.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        {step === "select_sheet" && (
          <DialogFooter className="shrink-0 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setStep("upload")}>Voltar</Button>
            <Button
              onClick={handleConfirmSheets}
              disabled={selectedSheets.size !== 1}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Analisar aba selecionada
            </Button>
          </DialogFooter>
        )}

        {step === "validate_blocks" && (
          <DialogFooter className="shrink-0 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setStep(sheets.length > 1 ? "select_sheet" : "upload")}>
              Voltar
            </Button>
            <Button
              onClick={handleProceedFromValidation}
              disabled={detectedBlocks.filter(b => b.confirmed && !b.ignored).length === 0}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Processar {detectedBlocks.filter(b => b.confirmed && !b.ignored).length} bloco(s)
            </Button>
          </DialogFooter>
        )}

        {step === "preview" && (
          <DialogFooter className="shrink-0 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setStep("validate_blocks")}>
              Voltar
            </Button>
            <Button onClick={handleImport} disabled={selectedCount === 0 || blockingIssues.length > 0} className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Importar {selectedCount} {selectedCount === 1 ? "item" : "itens"}
              {resources.length > 0 && ` + ${resources.length} recursos`}
            </Button>
          </DialogFooter>
        )}

        {step === "conflict" && (
          <DialogFooter className="shrink-0 border-t border-border pt-3">
            <Button variant="outline" onClick={() => setStep("preview")}>Voltar</Button>
            {importMode === "replace" ? (
              <Button variant="destructive" onClick={handleConfirmConflict} className="gap-2">
                <AlertTriangle className="w-4 h-4" />
                Substituir e Importar
              </Button>
            ) : (
              <Button onClick={handleConfirmConflict} className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Mesclar e Importar
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
