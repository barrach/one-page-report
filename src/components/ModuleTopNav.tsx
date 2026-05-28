import { Link } from "react-router-dom";

export default function ModuleTopNav() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex h-10 items-center border-b border-border bg-background/95 px-3 backdrop-blur-sm">
      <Link
        to="/"
        className="flex items-center gap-1.5 group"
        title="Voltar ao MegaHub"
      >
        <div className="h-5 w-5 rounded-md gradient-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground font-black text-[10px] leading-none">M</span>
        </div>
        <span className="text-[12px] font-black text-foreground tracking-tight group-hover:text-primary transition-colors">
          MegaHub
        </span>
      </Link>
    </div>
  );
}
