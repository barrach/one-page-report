import { Link, useLocation } from "react-router-dom";
import { BarChart2, Activity, LayoutGrid, TrendingUp } from "lucide-react";

export default function ModuleTopNav() {
  const location = useLocation();
  const isHub = location.pathname === "/";
  const isOPR = location.pathname.startsWith("/opr");
  const isProdControl = location.pathname.startsWith("/prodcontrol");
  const isControladoria = location.pathname.startsWith("/controladoria");

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex h-10 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-sm">
      {/* Logo MegaHub → volta ao hub */}
      <Link
        to="/"
        className="flex items-center gap-1.5 shrink-0 group"
        title="Voltar ao MegaHub"
      >
        <div className="h-5 w-5 rounded-md gradient-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-black text-[10px] leading-none">M</span>
        </div>
        <span className="text-[12px] font-black text-foreground tracking-tight group-hover:text-primary transition-colors">
          MegaHub
        </span>
      </Link>

      <span className="text-border text-xs mx-0.5">/</span>

      {/* Módulos */}
      <div className="flex items-center gap-1">
        <Link
          to="/opr"
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            isOPR
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <BarChart2 className="h-3 w-3" />
          One Page Report
        </Link>

        <Link
          to="/prodcontrol"
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            isProdControl
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Activity className="h-3 w-3" />
          ProdControl
        </Link>

        <Link
          to="/controladoria"
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            isControladoria
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <TrendingUp className="h-3 w-3" />
          Controladoria
        </Link>
      </div>

      {/* Indicador "Hub" quando estiver na raiz */}
      {isHub && (
        <span className="ml-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
          <LayoutGrid className="h-3 w-3" />
          Selecione um módulo
        </span>
      )}
    </div>
  );
}
