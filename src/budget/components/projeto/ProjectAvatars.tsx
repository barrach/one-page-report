import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@budget/components/ui/tooltip";
import { Crown } from "lucide-react";
import { cn } from "@budget/lib/utils";

interface Member {
  name: string;
  email: string;
  role: "owner" | "editor" | "viewer";
}

interface ProjectAvatarsProps {
  members: Member[];
  max?: number;
}

const COLORS = [
  "hsl(210, 70%, 50%)", "hsl(340, 70%, 50%)", "hsl(160, 70%, 40%)",
  "hsl(30, 80%, 50%)", "hsl(270, 60%, 50%)", "hsl(190, 70%, 45%)",
  "hsl(0, 65%, 50%)", "hsl(120, 50%, 40%)", "hsl(50, 80%, 45%)",
];

const hashColor = (str: string) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
};

const initials = (name: string, email: string) => {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
};

const roleLabel = (role: string) => {
  switch (role) {
    case "owner": return "Dono";
    case "editor": return "Editor";
    case "viewer": return "Visualizador";
    default: return role;
  }
};

const ProjectAvatars = ({ members, max = 3 }: ProjectAvatarsProps) => {
  if (!members || members.length === 0) return null;

  const visible = members.slice(0, max);
  const overflow = members.length - max;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center -space-x-2" onClick={(e) => e.preventDefault()}>
        {visible.map((m, i) => (
          <Tooltip key={m.email}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "relative w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-card cursor-default transition-transform hover:scale-110 hover:z-10",
                )}
                style={{ backgroundColor: hashColor(m.email), color: "#fff", zIndex: visible.length - i }}
              >
                {m.role === "owner" && (
                  <Crown className="absolute -top-1.5 -right-0.5 w-2.5 h-2.5 text-amber-400 drop-shadow" />
                )}
                {initials(m.name, m.email)}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-medium">{m.name || m.email}</p>
              {m.name && <p className="text-muted-foreground">{m.email}</p>}
              <p className="text-primary text-[10px]">{roleLabel(m.role)}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-card bg-muted text-muted-foreground cursor-default"
                style={{ zIndex: 0 }}
              >
                +{overflow}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {members.slice(max).map((m) => (
                <div key={m.email} className="py-0.5">
                  <span className="font-medium">{m.name || m.email}</span>
                  <span className="text-muted-foreground ml-1">({roleLabel(m.role)})</span>
                </div>
              ))}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};

export default ProjectAvatars;
