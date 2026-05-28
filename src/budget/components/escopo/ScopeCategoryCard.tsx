import { Card } from "@budget/components/ui/card";
import { Badge } from "@budget/components/ui/badge";
import { ArrowRight, FileText, Wrench, CheckCircle, Package, Users, Truck, AlertTriangle, Calculator } from "lucide-react";
import type { ScopeItem } from "@budget/hooks/useScopeData";

const iconMap: Record<string, React.ElementType> = {
  Wrench, CheckCircle, FileText, Package, Users, Truck, AlertTriangle,
};

interface Props {
  categoryKey: string;
  label: string;
  icon: string;
  items: ScopeItem[];
  totalHH?: number;
  onClick: () => void;
}

export default function ScopeCategoryCard({ label, icon, items, totalHH, onClick }: Props) {
  const Icon = iconMap[icon] || FileText;
  const totalQty = items.reduce((s, i) => s + Number(i.quantity || 0), 0);

  return (
    <Card
      onClick={onClick}
      className="p-4 bg-card border-border hover:border-primary/40 transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground">{label}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-lg font-bold text-foreground">{items.length}</span>
            <span className="text-xs text-muted-foreground">itens</span>
            {totalQty > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                Qty: {totalQty}
              </Badge>
            )}
          </div>
          {(totalHH ?? 0) > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Calculator className="w-3 h-3 text-primary" />
              <span className="text-xs font-mono text-primary font-medium">
                {totalHH!.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} HH
              </span>
            </div>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary mt-1" />
      </div>
    </Card>
  );
}
