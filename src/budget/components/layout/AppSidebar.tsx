import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FolderOpen,
  Library,
  Upload,
  ChevronLeft,
  ChevronRight,
  HardHat,
  LogOut,
  FileText,
  Settings,
  Building2,
  Briefcase,
  X,
} from "lucide-react";
import { cn } from "@budget/lib/utils";
import { useAuth } from "@budget/hooks/useAuth";
import { usePermissions, type PermissionKey } from "@budget/hooks/usePermissions";
import { supabase } from "@budget/integrations/supabase/client";
import { ROUTE_PREFETCH } from "@budget/App";

const prefetchRoute = (path: string) => {
  const loader = ROUTE_PREFETCH[path];
  if (loader) {
    try {
      loader();
    } catch {
      /* ignore */
    }
  }
};

const ADMIN_EMAIL = "michel.zabalia@megasteam.com.br";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly: boolean;
  permissionKey?: PermissionKey;
}

const allNavItems: NavItem[] = [
  { path: "/budget/projetos", label: "Orçamentos", icon: FolderOpen, adminOnly: false, permissionKey: "projetos" },
  { path: "/budget/propostas", label: "Propostas", icon: FileText, adminOnly: false, permissionKey: "propostas" },
  { path: "/budget/contratos", label: "Contratos", icon: Briefcase, adminOnly: false },
  { path: "/budget/biblioteca", label: "Biblioteca Técnica", icon: Library, adminOnly: false },
  { path: "/budget/importacao", label: "Importar Planilhas", icon: Upload, adminOnly: true, permissionKey: "importar_planilhas" },
  { path: "/budget/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
];

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const AppSidebar = ({
  mobileOpen,
  onMobileClose,
  collapsed: collapsedProp,
  onToggleCollapsed,
}: AppSidebarProps) => {
  const [collapsedInternal, setCollapsedInternal] = useState(false);
  const collapsed = collapsedProp ?? collapsedInternal;
  const toggleCollapsed = onToggleCollapsed ?? (() => setCollapsedInternal((c) => !c));
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { hasPermission } = usePermissions();
  const isAdmin = user?.email === ADMIN_EMAIL;
  const navItems = allNavItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.permissionKey && !hasPermission(item.permissionKey)) return false;
    return true;
  });

  const path = location.pathname;

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["pending-users-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count || 0;
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  // Close mobile sidebar on route change
  useEffect(() => {
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [location.pathname]);

  const isItemActive = (item: NavItem) => {
    if (item.path === "/budget/projetos" && path.startsWith("/budget/projeto")) return true;
    return path === item.path;
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-all duration-300",
          "max-lg:-translate-x-full max-lg:w-64",
          mobileOpen && "max-lg:translate-x-0",
          "lg:translate-x-0",
          collapsed ? "lg:w-16" : "lg:w-60"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <HardHat className="w-5 h-5 text-primary-foreground" />
          </div>
          {(!collapsed || mobileOpen) && (
            <span className="text-foreground font-bold text-lg tracking-tight flex-1">
              MegaBudget
            </span>
          )}
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1 rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isItemActive(item);
            const showLabel = !collapsed || mobileOpen;
            return (
              <Link
                key={item.path}
                to={item.path}
                onMouseEnter={() => prefetchRoute(item.path)}
                onFocus={() => prefetchRoute(item.path)}
                onTouchStart={() => prefetchRoute(item.path)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                title={collapsed && !mobileOpen ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {showLabel && <span>{item.label}</span>}
                {item.path === "/budget/configuracoes" && pendingCount > 0 && (
                  <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User + Sign out */}
        {user && (
          <div className="px-2 pb-2">
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive transition-all w-full"
              title={collapsed && !mobileOpen ? "Sair" : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {(!collapsed || mobileOpen) && <span>Sair</span>}
            </button>
          </div>
        )}

        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex items-center justify-center h-12 border-t border-sidebar-border text-sidebar-foreground hover:text-foreground transition-colors"
          aria-label={collapsed ? "Abrir sidebar" : "Recolher sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>
    </>
  );
};

export default AppSidebar;
