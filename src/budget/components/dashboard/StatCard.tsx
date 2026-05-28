import { cn } from "@budget/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "accent" | "success";
}

const variantStyles = {
  default: "border-border",
  primary: "border-primary/30 stat-glow",
  accent: "border-accent/30 accent-glow",
  success: "border-success/30",
};

const iconVariants = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/15 text-primary",
  accent: "bg-accent/15 text-accent",
  success: "bg-success/15 text-success",
};

const StatCard = ({ label, value, subtitle, icon: Icon, variant = "default" }: StatCardProps) => (
  <div className={cn("glass-card p-5 animate-fade-in", variantStyles[variant])}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className={cn("p-2.5 rounded-lg", iconVariants[variant])}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

export default StatCard;
