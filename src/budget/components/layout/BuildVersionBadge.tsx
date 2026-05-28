import { Badge } from "@budget/components/ui/badge";
import { getCurrentBuildInfo } from "@budget/lib/buildVersion";

const formatBuildLabel = (buildId: string) => {
  const parsedDate = new Date(buildId);
  if (Number.isNaN(parsedDate.getTime())) return buildId;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(parsedDate);
};

interface BuildVersionBadgeProps {
  compact?: boolean;
}

const BuildVersionBadge = ({ compact = false }: BuildVersionBadgeProps) => {
  const { buildId, assetHash, signature } = getCurrentBuildInfo();
  const label = formatBuildLabel(buildId);
  const hashLabel = assetHash ? ` · ${assetHash}` : "";

  return (
    <Badge
      variant="outline"
      className={compact ? "h-7 px-2 text-[10px] font-medium" : "px-3 py-1 text-[11px] font-medium"}
      title={`Build atual: ${buildId}${assetHash ? ` | hash ${assetHash}` : ""}\n${signature}`}
    >
      {compact ? `Build ${label}${hashLabel}` : `Versão publicada: ${label}${hashLabel}`}
    </Badge>
  );
};

export default BuildVersionBadge;
