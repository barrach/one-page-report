import { Link, useLocation } from "react-router-dom";
import { BarChart2, Activity } from "lucide-react";

export default function ModuleTopNav() {
  const location = useLocation();
  const isProdControl = location.pathname.startsWith("/prodcontrol");

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex h-10 items-center gap-1 border-b border-border bg-background/95 px-3 backdrop-blur-sm">
      <span className="mr-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Módulo:
      </span>
      <Link
        to="/"
        className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          !isProdControl
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <BarChart2 className="h-3.5 w-3.5" />
        One Page Report
      </Link>
      <Link
        to="/prodcontrol"
        className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          isProdControl
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <Activity className="h-3.5 w-3.5" />
        ProdControl
      </Link>
    </div>
  );
}
