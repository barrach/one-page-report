import { Card } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { Button } from "@budget/components/ui/button";
import { Checkbox } from "@budget/components/ui/checkbox";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@budget/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@budget/components/ui/tooltip";
import {
  CheckCircle, AlertTriangle, Eye, EyeOff, Info, Sparkles, Table2, Brain,
} from "lucide-react";
import type { DetectedBlock, BlockType, SheetAnalysis } from "@budget/lib/universalParser";
import {
  BLOCK_TYPE_OPTIONS,
  getBlockTypeLabel,
  getBlockTypeIcon,
  getConfidenceColor,
  getConfidenceLabel,
} from "@budget/lib/universalParser";
import type { PatternMatch } from "@budget/hooks/useParserMemory";

interface Props {
  analysis: SheetAnalysis;
  blocks: DetectedBlock[];
  onUpdateBlock: (blockId: string, updates: Partial<DetectedBlock>) => void;
  onConfirmAll: () => void;
  fileName: string;
  patternMatches?: Map<string, PatternMatch>;
  autoMatchRate?: number;
  patternCount?: number;
}

export default function BlockValidationStep({ analysis, blocks, onUpdateBlock, onConfirmAll, fileName, patternMatches, autoMatchRate = 0, patternCount = 0 }: Props) {
  const confirmedCount = blocks.filter(b => b.confirmed && !b.ignored).length;
  const ignoredCount = blocks.filter(b => b.ignored).length;
  const pendingCount = blocks.filter(b => !b.confirmed && !b.ignored).length;
  const highConfidence = blocks.filter(b => b.confidence >= 80 && !b.ignored).length;
  const autoAppliedCount = patternMatches ? Array.from(patternMatches.values()).filter(m => m.autoApplied).length : 0;

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Header summary */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium text-foreground">
            Validação da Estrutura do Arquivo
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Arquivo: <span className="font-medium text-foreground">{fileName}</span>
          {" — "}Aba: <span className="font-medium text-foreground">{analysis.sheetName}</span>
        </p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Card className="p-2 bg-card border-border">
            <p className="text-[10px] text-muted-foreground uppercase">Blocos</p>
            <p className="text-lg font-bold font-mono text-foreground">{blocks.length}</p>
          </Card>
          <Card className="p-2 bg-card border-border">
            <p className="text-[10px] text-muted-foreground uppercase">Linhas</p>
            <p className="text-lg font-bold font-mono text-foreground">{analysis.totalRows}</p>
          </Card>
          <Card className="p-2 bg-primary/5 border-primary/20">
            <p className="text-[10px] text-muted-foreground uppercase">Confirmados</p>
            <p className="text-lg font-bold font-mono text-primary">{confirmedCount}</p>
          </Card>
          <Card className="p-2 bg-accent/5 border-accent/20">
            <p className="text-[10px] text-muted-foreground uppercase">Pendentes</p>
            <p className="text-lg font-bold font-mono text-accent">{pendingCount}</p>
          </Card>
          <Card className="p-2 bg-muted border-border">
            <p className="text-[10px] text-muted-foreground uppercase">Ignorados</p>
            <p className="text-lg font-bold font-mono text-muted-foreground">{ignoredCount}</p>
          </Card>
        </div>

        {highConfidence === blocks.length && blocks.length > 0 && (
          <Card className="p-2 bg-primary/5 border-primary/20 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              Todos os blocos foram classificados com alta confiança. Verifique e confirme.
            </p>
            <Button size="sm" variant="outline" className="ml-auto text-xs h-7" onClick={onConfirmAll}>
              Confirmar todos
            </Button>
          </Card>
        )}

        {pendingCount > 0 && highConfidence < blocks.length && (
          <Card className="p-2 bg-accent/10 border-accent/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-accent shrink-0" />
            <p className="text-xs text-muted-foreground">
              {pendingCount} bloco(s) precisam de confirmação manual. Revise o tipo sugerido.
            </p>
          </Card>
        )}

        {autoAppliedCount > 0 && (
          <Card className="p-2 bg-primary/5 border-primary/20 flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{autoAppliedCount}</span> bloco(s) reconhecido(s) automaticamente com base em importações anteriores.
              {patternCount > 0 && <span className="ml-1 text-muted-foreground">({patternCount} padrões aprendidos)</span>}
            </p>
          </Card>
        )}
      </div>

      {/* Blocks list */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-2 pb-4 overscroll-contain scrollbar-subtle" style={{ maxHeight: 'calc(60vh - 120px)' }}>
        <div className="space-y-2 pr-1">
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              onUpdate={(updates) => onUpdateBlock(block.id, updates)}
              patternMatch={patternMatches?.get(block.id)}
            />
          ))}

          {blocks.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                Nenhum bloco estrutural foi detectado nesta aba.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tente selecionar outra aba ou verifique o formato do arquivo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <Card className="shrink-0 p-3 bg-accent/10 border-accent/20 space-y-1">
          <p className="text-xs font-medium text-foreground flex items-center gap-1">
            <Info className="w-3 h-3 text-accent" /> Observações
          </p>
          <ul className="text-[10px] text-muted-foreground list-disc list-inside space-y-0.5">
            {analysis.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ─── Block Card ──────────────────────────────────────────────────────────────

function BlockCard({
  block,
  onUpdate,
  patternMatch,
}: {
  block: DetectedBlock;
  onUpdate: (updates: Partial<DetectedBlock>) => void;
  patternMatch?: PatternMatch;
}) {
  const confidenceColor = getConfidenceColor(block.confidence);
  const isIgnored = block.ignored;
  const isConfirmed = block.confirmed && !block.ignored;

  return (
    <Card
      className={`p-3 transition-colors border ${
        isIgnored
          ? "border-border bg-muted/20 opacity-60"
          : isConfirmed
            ? "border-primary/30 bg-primary/5"
            : "border-accent/30 bg-accent/5"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className="pt-0.5">
          <Checkbox
            checked={!isIgnored}
            onCheckedChange={(checked) => onUpdate({ ignored: !checked, confirmed: !!checked })}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm">{getBlockTypeIcon(block.type)}</span>
            <span className="text-sm font-medium text-foreground truncate max-w-[200px]" title={block.title}>
              {block.title}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {block.rowCount} linhas
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Linhas {block.startRow}–{block.endRow}
            </Badge>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className={`text-[10px] ${confidenceColor}`}>
                    {getConfidenceLabel(block.confidence)} ({block.confidence}%)
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Confiança da classificação automática</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {patternMatch && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 gap-1">
                      <Brain className="w-2.5 h-2.5" />
                      {patternMatch.autoApplied ? "Auto" : "Sugestão"} ({patternMatch.similarity}%)
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {patternMatch.autoApplied
                        ? `Reconhecido automaticamente como "${patternMatch.patternName}"`
                        : `Baseado em importações anteriores: "${patternMatch.patternName}"`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Type selector + attributes */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={block.type}
              onValueChange={(v) => onUpdate({ type: v as BlockType, confirmed: true })}
            >
              <SelectTrigger className="h-7 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLOCK_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.icon} {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {block.hasNumericData && (
              <Badge variant="outline" className="text-[9px]">Dados numéricos</Badge>
            )}
            {block.hasPeriodColumns && (
              <Badge variant="outline" className="text-[9px]">Períodos temporais</Badge>
            )}
            {block.hasCurrencyData && (
              <Badge variant="outline" className="text-[9px]">Valores monetários</Badge>
            )}

            {!isConfirmed && !isIgnored && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2 gap-1"
                onClick={() => onUpdate({ confirmed: true })}
              >
                <CheckCircle className="w-3 h-3" /> Confirmar
              </Button>
            )}
          </div>

          {/* Sample data preview */}
          {block.sampleRows.length > 0 && !isIgnored && (
            <div className="rounded bg-muted/30 p-2 overflow-x-auto">
              {block.columnsDetected.length > 0 && (
                <div className="flex gap-2 mb-1 pb-1 border-b border-border">
                  {block.columnsDetected.slice(0, 6).map((col, i) => (
                    <span key={i} className="text-[9px] font-medium text-muted-foreground whitespace-nowrap">
                      {col}
                    </span>
                  ))}
                  {block.columnsDetected.length > 6 && (
                    <span className="text-[9px] text-muted-foreground">+{block.columnsDetected.length - 6}</span>
                  )}
                </div>
              )}
              {block.sampleRows.map((row, i) => (
                <div key={i} className="flex gap-2">
                  {row.slice(0, 6).map((cell, j) => (
                    <span key={j} className="text-[9px] text-muted-foreground whitespace-nowrap">
                      {cell.length > 20 ? cell.substring(0, 20) + "…" : cell}
                    </span>
                  ))}
                  {row.length > 6 && (
                    <span className="text-[9px] text-muted-foreground">+{row.length - 6}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
