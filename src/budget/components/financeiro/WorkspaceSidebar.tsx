import { useMemo, useState } from "react";
import { Wallet, ChevronDown, PanelLeftClose } from "lucide-react";
import { cn } from "@budget/lib/utils";
import { ScrollArea } from "@budget/components/ui/scroll-area";
import { Button } from "@budget/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@budget/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@budget/components/ui/collapsible";
import { NAV_GROUPS, type SectionKey, type NavGroup } from "./workspaceNav";
import { usePermissions } from "@budget/hooks/usePermissions";

interface WorkspaceSidebarProps {
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  /** Render a header (only on desktop, drawer renders its own) */
  withHeader?: boolean;
  /** Hide handler — when provided, renders a button to fully hide the sidebar */
  onToggleCollapsed?: () => void;
}

const NavGroupBlock = ({
  group,
  active,
  onSelect,
  defaultOpen,
}: {
  group: NavGroup;
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  defaultOpen: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-1">
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-1.5 group">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 group-hover:text-foreground transition-colors">
          {group.label}
        </span>
        <ChevronDown
          className={cn(
            "h-3 w-3 text-muted-foreground/50 transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5">
        {group.items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
};

const WorkspaceSidebar = ({
  active,
  onSelect,
  withHeader = true,
  onToggleCollapsed,
}: WorkspaceSidebarProps) => {
  const { isAdmin } = usePermissions();

  // Filter hidden + admin-only items and drop groups that end up empty
  const visibleGroups = useMemo<NavGroup[]>(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) => !i.hiddenInNav && (!i.adminOnly || isAdmin)),
      })).filter((g) => g.items.length > 0),
    [isAdmin],
  );

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full w-full">
        {withHeader && (
          <div className="border-b shrink-0 px-3 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight truncate">Controladoria</p>
                <p className="text-xs text-muted-foreground truncate">Workspace · Megasteam</p>
              </div>
              {onToggleCollapsed && (
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={onToggleCollapsed}
                      aria-label="Ocultar menu"
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Ocultar menu</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          <nav className="flex flex-col py-3 gap-3">
            {visibleGroups.map((group) => (
              <NavGroupBlock
                key={group.label}
                group={group}
                active={active}
                onSelect={onSelect}
                defaultOpen={
                  group.items.some((i) => i.key === active) ||
                  group.label === "Início" ||
                  group.label === "Visão Geral"
                }
              />
            ))}
          </nav>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
};

export default WorkspaceSidebar;
