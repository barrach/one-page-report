import { ReactNode, useState } from "react";
import AppSidebar from "./AppSidebar";
import BuildVersionBadge from "./BuildVersionBadge";
import ThemeToggle from "./ThemeToggle";
import InstallPrompt from "@budget/components/pwa/InstallPrompt";
import NotificationBell from "@budget/components/notifications/NotificationBell";
import { Menu, HardHat, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@budget/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  mainClassName?: string;
  fixedViewport?: boolean;
}

const AppLayout = ({ children, mainClassName, fixedViewport = false }: AppLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn("bg-background", fixedViewport ? "h-screen overflow-hidden" : "min-h-screen")}>
      <AppSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />

      {/* Main content area - offset for desktop sidebar */}
      <div
        className={cn(
          "flex flex-col transition-[margin] duration-300",
          fixedViewport ? "h-screen" : "min-h-screen",
          collapsed ? "lg:ml-16" : "lg:ml-60",
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6 py-2.5 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          {/* Mobile: hamburger + logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                <HardHat className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold text-foreground">MegaBudget</span>
            </div>
          </div>

          {/* Desktop: collapse/expand sidebar button */}
          <div className="hidden lg:flex items-center">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="p-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label={collapsed ? "Abrir sidebar" : "Recolher sidebar"}
              title={collapsed ? "Abrir sidebar" : "Recolher sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="w-5 h-5" />
              ) : (
                <PanelLeftClose className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className={cn("flex-1 min-h-0 p-4 lg:p-6 overflow-x-hidden", mainClassName)}>
          {children}
        </main>
      </div>
      <InstallPrompt />
    </div>
  );
};

export default AppLayout;
