import { useState, useEffect, useCallback, useRef } from "react";
import AppLayout from "@budget/components/layout/AppLayout";
import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Progress } from "@budget/components/ui/progress";
import { Upload, FileSpreadsheet, Check, Loader2, Trash2, AlertCircle } from "lucide-react";
import { supabase } from "@budget/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import MegasteamDrgUploader from "@budget/components/financeiro/MegasteamDrgUploader";
import BudgetAcompImporter from "@budget/components/financeiro/BudgetAcompImporter";

type LibraryKind = "productivity" | "salary" | "charge" | "material" | "index" | "equipment" | "risk" | "other";

interface ParsedRecord {
  kind: LibraryKind;
  discipline: string;
  group_name: string;
  item_type: string;
  operation: string;
  material: string;
  unit: string;
  index_label: string;
  index_value: number | null;
  source_workbook_name: string;
  source_sheet_name: string;
  source_label: string;
  notes: string;
  raw_data: Record<string, unknown>;
}

interface ImportedFile {
  name: string;
  sheets: number;
  records: number;
  status: "processing" | "done" | "error";
  date: string;
}

function clean(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (["undefined", "null", "NaN"].includes(s)) return "";
  return s;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v === 0 ? null : Math.round(v * 1e6) / 1e6;
  const s = String(v).trim().replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) || n === 0 ? null : Math.round(n * 1e6) / 1e6;
}

function detectDiscipline(sheetName: string): string {
  const s = sheetName.toUpperCase();
  const map: [string, string][] = [
    ["ELÉTR", "Elétrica"], ["CABO", "Elétrica"], ["LEITO", "Elétrica"],
    ["ELETROCALHA", "Elétrica"], ["SUBEST", "Elétrica"], ["INTERR", "Elétrica"],
    ["MECÂN", "Mecânica"], ["INSTRU", "Instrumentação"],
    ["TUBUL", "Tubulação"], ["PIPE", "Tubulação"], ["CONEX", "Tubulação"],
    ["TEE", "Tubulação"], ["VÁLV", "Tubulação"], ["CURV", "Tubulação"],
    ["CIVIL", "Civil"], ["SOLD", "Soldagem"],
    ["PINTU", "Pintura"], ["JATO", "Pintura"],
    ["ISOL", "Isolamento"], ["REFRAT", "Isolamento"], ["REVEST", "Isolamento"],
    ["RADIO", "END"], ["GAMAGR", "END"], ["ANDAI", "Andaime"],
    ["GAS", "Consumo"], ["BARRA", "Caldeiraria"], ["CHAPA", "Caldeiraria"],
    ["TUBO", "Caldeiraria"], ["CANTON", "Caldeiraria"], ["VIGA", "Caldeiraria"],
    ["PARAF", "Caldeiraria"], ["PORCA", "Caldeiraria"],
  ];
  for (const [k, d] of map) {
    if (s.includes(k)) return d;
  }
  return "Geral";
}

function detectKind(sheetName: string, headers: string[]): LibraryKind {
  const all = (sheetName + " " + headers.join(" ")).toUpperCase();
  if (all.includes("SALÁR") || all.includes("DEFLAT") || all.includes("FUNÇ")) return "salary";
  if (all.includes("KG") && (all.includes("PESO") || all.includes("MATERIAL"))) return "material";
  if (all.includes("ENCARG") || all.includes("CHARGE")) return "charge";
  if (all.includes("EQUIP") && !all.includes("ÍNDICE")) return "equipment";
  if (all.includes("RISCO") || all.includes("RISK")) return "risk";
  if (all.includes("PRODUTIV") || all.includes("IPMO") || all.includes("HH")) return "productivity";
  if (all.includes("ÍNDICE") || all.includes("INDEX")) return "index";
  return "productivity";
}

function parseWorkbook(wb: XLSX.WorkBook, fileName: string): ParsedRecord[] {
  const records: ParsedRecord[] = [];
  const skipSheets = new Set(["PÁGINA INICIAL", "PLANILHAS DE ELÉTRICA", "PLANILHAS DE MECÂNICA", "Folha Rosto", "Indices"]);

  for (const sn of wb.SheetNames) {
    if (skipSheets.has(sn)) continue;
    const ws = wb.Sheets[sn];
    if (!ws) continue;

    const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (data.length < 3) continue;

    const disc = detectDiscipline(sn);

    // Find header row
    let headerIdx = -1;
    let headers: string[] = [];
    for (let i = 0; i < Math.min(12, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      const vals = row.map(v => clean(v));
      const joined = vals.join(" ").toUpperCase();
      const keywords = ["CÓDIGO", "CÓDIGOS", "DESCRIÇÃO", "DESCRÇÃO", "BITOLA", "KG", "DIÂM", "NOMINAIS", "ESP. POL", "POL", "FUNÇ", "NÍVEL", "ITEM"];
      if (keywords.some(k => joined.includes(k))) {
        const nonEmpty = vals.filter(v => v);
        if (nonEmpty.length >= 2) {
          headerIdx = i;
          headers = vals;
          break;
        }
      }
    }

    if (headerIdx === -1) continue;

    // Check sub-header
    let dataStart = headerIdx + 1;
    if (dataStart < data.length) {
      const subRow = data[dataStart];
      if (subRow) {
        const subVals = subRow.map(v => clean(v));
        const nonEmpty = subVals.filter(v => v);
        const hasCode = subVals.some(v => /^[A-Z]{2}\.\d/.test(v));
        if (nonEmpty.length >= 1 && !hasCode) {
          // Merge sub-headers
          subVals.forEach((sv, j) => {
            if (j < headers.length && !headers[j] && sv) headers[j] = sv;
            else if (j < headers.length && sv && headers[j]) headers[j] = `${headers[j]} - ${sv}`;
          });
          dataStart++;
        }
      }
    }

    const kind = detectKind(sn, headers);
    let currentGroup = sn;

    // Find section title
    for (let i = 0; i < Math.min(10, data.length); i++) {
      for (const c of (data[i] || [])) {
        const s = clean(c);
        if (s && /^[A-Z]{2}\.\d/.test(s)) {
          currentGroup = s.substring(0, 40);
          break;
        }
      }
    }

    for (let i = dataStart; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      const vals = row.map(v => v);
      const nonEmpty = vals.map(v => clean(v)).filter(v => v);

      if (nonEmpty.length === 0) continue;
      if (nonEmpty.length === 1 && toNum(nonEmpty[0]) === null) {
        currentGroup = nonEmpty[0];
        continue;
      }
      if (nonEmpty.length < 2) continue;

      const col0 = clean(vals[0]);
      const col1 = clean(vals[1]);

      if (kind === "salary") {
        const funcao = col1;
        if (!funcao) continue;
        const cod = clean(vals[2]);
        const modMoi = clean(vals[3]);
        for (let ci = 4; ci < Math.min(vals.length, 30); ci++) {
          const n = toNum(vals[ci]);
          if (n !== null && n > 500) {
            records.push({
              kind: "salary", discipline: col0, group_name: modMoi, item_type: funcao,
              operation: cod, material: "", unit: "R$/mês",
              index_label: headers[ci] || `Região ${ci}`, index_value: n,
              source_workbook_name: fileName, source_sheet_name: sn,
              source_label: `Nível: ${col0}, Tipo: ${modMoi}`, notes: "", raw_data: {},
            });
          }
        }
      } else if (kind === "material") {
        if (!col0) continue;
        for (let ci = 1; ci < vals.length; ci++) {
          const n = toNum(vals[ci]);
          if (n === null) continue;
          const h = (headers[ci] || "").toUpperCase();
          if (h.includes("KG") || h.includes("PESO")) {
            records.push({
              kind: "material", discipline: disc, group_name: sn, item_type: col0,
              operation: "", material: sn, unit: h.includes("/M") ? "kg/m" : "kg",
              index_label: headers[ci] || "Peso", index_value: n,
              source_workbook_name: fileName, source_sheet_name: sn,
              source_label: `Tabela de peso - ${sn}`, notes: "", raw_data: {},
            });
          }
        }
      } else {
        // productivity / index - handle both 4-col and multi-col tables
        if (headers.length <= 5) {
          const metric = clean(vals[2]);
          const hh = toNum(vals[3]) ?? toNum(vals[2]);
          if (hh !== null) {
            records.push({
              kind, discipline: disc, group_name: currentGroup, item_type: col1,
              operation: col0, material: "", unit: metric || "",
              index_label: "IPMO (HH)", index_value: hh,
              source_workbook_name: fileName, source_sheet_name: sn,
              source_label: currentGroup, notes: "", raw_data: {},
            });
          }
        } else {
          for (let ci = 2; ci < Math.min(vals.length, 20); ci++) {
            const n = toNum(vals[ci]);
            if (n === null) continue;
            const colLabel = headers[ci] || `Col${ci}`;
            records.push({
              kind, discipline: disc, group_name: currentGroup,
              item_type: col1 ? `${col1} (${colLabel})` : col0,
              operation: col0, material: "", unit: "HH",
              index_label: colLabel, index_value: n,
              source_workbook_name: fileName, source_sheet_name: sn,
              source_label: currentGroup, notes: "", raw_data: {},
            });
          }
        }
      }
    }
  }

  return records;
}

const Importacao = () => {
  const [importedFiles, setImportedFiles] = useState<ImportedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [dbCount, setDbCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadCount = async () => {
      const { count } = await supabase
        .from("technical_library_items")
        .select("*", { count: "exact", head: true });
      setDbCount(count ?? 0);
    };
    loadCount();

    // Load saved import history from localStorage
    const saved = localStorage.getItem("megabudget_imports");
    if (saved) {
      try { setImportedFiles(JSON.parse(saved)); } catch {}
    }
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    const allRecords: ParsedRecord[] = [];
    const newFiles: ImportedFile[] = [];

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      setProgressLabel(`Lendo ${file.name}...`);
      setProgress(Math.round(((fi) / files.length) * 30));

      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array" });
        const records = parseWorkbook(wb, file.name);

        allRecords.push(...records);
        newFiles.push({
          name: file.name,
          sheets: wb.SheetNames.length,
          records: records.length,
          status: "done",
          date: new Date().toLocaleDateString("pt-BR"),
        });
      } catch (err) {
        console.error(`Error parsing ${file.name}:`, err);
        newFiles.push({
          name: file.name, sheets: 0, records: 0, status: "error",
          date: new Date().toLocaleDateString("pt-BR"),
        });
      }
    }

    if (allRecords.length === 0) {
      toast.error("Nenhum registro extraído dos arquivos");
      setIsProcessing(false);
      return;
    }

    setProgressLabel(`Enviando ${allRecords.length.toLocaleString()} registros...`);
    setProgress(40);

    // Send in batches
    const batchSize = 2000;
    let totalInserted = 0;

    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize);
      setProgress(40 + Math.round((i / allRecords.length) * 55));
      setProgressLabel(`Inserindo registros ${i + 1}-${Math.min(i + batchSize, allRecords.length)} de ${allRecords.length.toLocaleString()}...`);

      try {
        const { data, error } = await supabase.functions.invoke("seed-library", {
          body: { records: batch, clear_existing: i === 0 },
        });

        if (error) {
          console.error("Insert error:", error);
          toast.error(`Erro ao inserir registros: ${error.message}`);
          break;
        }
        totalInserted += data?.inserted ?? batch.length;
      } catch (err) {
        console.error("Network error:", err);
        toast.error("Erro de conexão ao inserir registros");
        break;
      }
    }

    setProgress(100);
    setProgressLabel("Importação concluída!");
    setDbCount(totalInserted);

    const updatedFiles = [...newFiles, ...importedFiles];
    setImportedFiles(updatedFiles);
    localStorage.setItem("megabudget_imports", JSON.stringify(updatedFiles));

    toast.success(`${totalInserted.toLocaleString()} registros importados com sucesso!`);

    setTimeout(() => {
      setIsProcessing(false);
      setProgress(0);
      setProgressLabel("");
    }, 2000);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [importedFiles]);

  return (
    <AppLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Importação de Planilhas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Importe planilhas Excel para alimentar a biblioteca técnica •{" "}
          <span className="text-primary font-semibold">{dbCount.toLocaleString()}</span> registros na base
        </p>
      </div>

      {/* Upload area */}
      <Card className="p-8 bg-card border-border border-dashed mb-6">
        <div className="flex flex-col items-center text-center">
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <Upload className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-foreground font-semibold mb-1">Importar Planilhas</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Arraste arquivos Excel (.xlsx, .xls, .xlsm) ou clique para selecionar.
            O sistema irá ler todas as abas, identificar cabeçalhos e extrair registros automaticamente.
          </p>

          {isProcessing ? (
            <div className="w-full max-w-md space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-foreground">{progressLabel}</span>
              </div>
              <Progress value={progress} className="h-2" />
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button className="gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4" /> Selecionar Arquivos
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Imported files */}
      {importedFiles.length > 0 && (
        <Card className="bg-card border-border overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Planilhas Importadas</h3>
            <Badge variant="secondary">{importedFiles.length} arquivos</Badge>
          </div>
          <div className="divide-y divide-border/50">
            {importedFiles.map((f) => (
              <div key={f.name + f.date} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className={`w-5 h-5 ${f.status === "error" ? "text-destructive" : "text-emerald-500"}`} />
                  <div>
                    <p className="text-sm text-foreground font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.sheets} abas • {f.records.toLocaleString()} registros • {f.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {f.status === "error" ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <span className="text-xs text-destructive">Erro</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs text-emerald-500">Importado</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Budget Comparativo (Real x Orçado) — importador inteligente */}
      <div className="mt-8">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-foreground">Budget Comparativo (Real x Orçado)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lê a aba <code className="text-xs">Budget_Acomp</code> de qualquer arquivo de comparativo mensal,
            extrai automaticamente os códigos do Plano Gerencial e usa IA para mapear o que sobrar.
          </p>
        </div>
        <BudgetAcompImporter />
      </div>

      {/* DRG Consolidado Megasteam — uploader dedicado */}
      <div className="mt-8">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-foreground">DRG Consolidado Megasteam</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload do workbook mensal <code className="text-xs">Resultado_Megasteam_*_DRG.xlsx</code>.
            O pipeline executa automaticamente as 6 etapas: cadastro de contratos, alíquotas de imposto,
            DRG por contrato, rateio administrativo, headcount e validação contra o DRG-RESUMO. Reimportar
            o mesmo mês substitui os dados sem duplicar.
          </p>
        </div>
        <MegasteamDrgUploader />
      </div>
    </AppLayout>
  );
};

export default Importacao;
