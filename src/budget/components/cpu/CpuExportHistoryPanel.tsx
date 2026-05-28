import { Card } from "@budget/components/ui/card";
import { Button } from "@budget/components/ui/button";
import { Badge } from "@budget/components/ui/badge";
import { Download, History, Loader2, Trash2 } from "lucide-react";
import { useCpuExports, useDownloadCpuExport, useDeleteCpuExport, type CpuExportRow } from "@budget/hooks/useCpuExports";
import { formatBRL } from "@budget/lib/format";

interface Props {
  projectId: string;
}

const CpuExportHistoryPanel = ({ projectId }: Props) => {
  const { data: exports = [], isLoading } = useCpuExports(projectId);
  const dl = useDownloadCpuExport();
  const remove = useDeleteCpuExport();

  return (
    <Card className="p-4 space-y-3 bg-card border-border">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Histórico de exportações da CPU</h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-xs">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Carregando…
        </div>
      ) : exports.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhuma exportação ainda.</p>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left p-2 font-medium">Data</th>
                <th className="text-left p-2 font-medium">Arquivo</th>
                <th className="text-center p-2 font-medium w-20">Versão</th>
                <th className="text-center p-2 font-medium w-28">Tipo</th>
                <th className="text-right p-2 font-medium w-32">Total</th>
                <th className="text-left p-2 font-medium">Por</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {exports.map((row: CpuExportRow) => (
                <tr key={row.id} className="border-t border-border/40">
                  <td className="p-2 text-muted-foreground font-mono">
                    {new Date(row.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="p-2 text-foreground">{row.file_name}</td>
                  <td className="p-2 text-center font-mono">v{row.budget_version}</td>
                  <td className="p-2 text-center">
                    <Badge variant="outline" className="text-[10px]">
                      {row.template_kind === "client_template" ? "Cliente" : "Padrão"}
                    </Badge>
                  </td>
                  <td className="p-2 text-right font-mono">{formatBRL(row.total_value)}</td>
                  <td className="p-2 text-muted-foreground text-[11px]">{row.exported_by_email || "—"}</td>
                  <td className="p-2 flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      title="Baixar novamente"
                      disabled={dl.isPending}
                      onClick={() => dl.mutate(row)}>
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive"
                      onClick={() => { if (confirm(`Remover do histórico?`)) remove.mutate(row); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default CpuExportHistoryPanel;
