import { Card } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";
import type { DetectedBlock } from "@budget/lib/universalParser";
import { getBlockTypeLabel, getBlockTypeIcon } from "@budget/lib/universalParser";

export interface ImportResult {
  totalBlocksRead: number;
  totalBlocksConfirmed: number;
  totalBlocksIgnored: number;
  totalLinesImported: number;
  totalLinesIgnored: number;
  totalPhases: number;
  totalTasks: number;
  totalResources: number;
  totalHH: number;
  totalCosts: number;
  inconsistencies: string[];
  importedBlocks: Array<{ type: string; name: string; rows: number }>;
}

interface Props {
  result: ImportResult;
  blocks: DetectedBlock[];
}

export default function ImportSummaryPanel({ result, blocks }: Props) {
  const hasIssues = result.inconsistencies.length > 0;

  return (
    <div className="space-y-3">
      {/* Status banner */}
      <Card className={`p-3 ${hasIssues ? "bg-accent/10 border-accent/20" : "bg-primary/5 border-primary/20"} flex items-center gap-2`}>
        {hasIssues ? (
          <AlertTriangle className="w-4 h-4 text-accent shrink-0" />
        ) : (
          <CheckCircle className="w-4 h-4 text-primary shrink-0" />
        )}
        <p className="text-xs text-foreground font-medium">
          {hasIssues
            ? `Importação concluída com ${result.inconsistencies.length} observação(ões)`
            : "Importação concluída com sucesso"
          }
        </p>
      </Card>

      {/* Summary grid */}
      <Card className="p-4 bg-card border-border space-y-3">
        <p className="text-sm font-medium text-foreground">Resumo da Importação</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <SummaryItem label="Blocos lidos" value={result.totalBlocksRead} />
          <SummaryItem label="Blocos confirmados" value={result.totalBlocksConfirmed} highlight="primary" />
          <SummaryItem label="Blocos ignorados" value={result.totalBlocksIgnored} />
          <SummaryItem label="Linhas importadas" value={result.totalLinesImported} highlight="primary" />
          <SummaryItem label="Linhas ignoradas" value={result.totalLinesIgnored} />
          <SummaryItem label="Fases" value={result.totalPhases} highlight="primary" />
          <SummaryItem label="Tarefas" value={result.totalTasks} />
          <SummaryItem label="Recursos" value={result.totalResources} highlight="accent" />
          {result.totalHH > 0 && (
            <SummaryItem label="HH Total" value={result.totalHH.toLocaleString("pt-BR")} highlight="primary" />
          )}
          {result.totalCosts > 0 && (
            <SummaryItem label="Custos" value={`R$ ${result.totalCosts.toLocaleString("pt-BR")}`} />
          )}
        </div>
      </Card>

      {/* Imported blocks detail */}
      {result.importedBlocks.length > 0 && (
        <Card className="p-4 bg-card border-border space-y-2">
          <p className="text-sm font-medium text-foreground">Blocos Importados</p>
          <div className="space-y-1">
            {result.importedBlocks.map((block, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/30 text-xs">
                <span>{getBlockTypeIcon(block.type as any)}</span>
                <span className="text-foreground font-medium flex-1">{block.name}</span>
                <Badge variant="secondary" className="text-[10px]">{block.rows} linhas</Badge>
                <Badge variant="outline" className="text-[10px]">{getBlockTypeLabel(block.type as any)}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Confirmed blocks from validation */}
      {blocks.length > 0 && (
        <Card className="p-4 bg-card border-border space-y-2">
          <p className="text-sm font-medium text-foreground">Detalhamento por Bloco</p>
          <div className="flex flex-wrap gap-2">
            {blocks.filter(b => b.confirmed && !b.ignored).map(block => (
              <Badge key={block.id} variant="default" className="text-[10px] gap-1">
                {getBlockTypeIcon(block.type)} {block.title.substring(0, 30)}
              </Badge>
            ))}
            {blocks.filter(b => b.ignored).map(block => (
              <Badge key={block.id} variant="outline" className="text-[10px] gap-1 opacity-50">
                {getBlockTypeIcon(block.type)} {block.title.substring(0, 30)} (ignorado)
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Inconsistencies */}
      {result.inconsistencies.length > 0 && (
        <Card className="p-4 bg-accent/10 border-accent/20 space-y-2">
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-accent" />
            Inconsistências Encontradas
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            {result.inconsistencies.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function SummaryItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "primary" | "accent";
}) {
  const valueClass = highlight === "primary"
    ? "text-primary"
    : highlight === "accent"
      ? "text-accent"
      : "text-foreground";

  return (
    <div className="flex justify-between p-2 rounded bg-muted/30">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}
