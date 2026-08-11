import { Link, useLocation } from 'react-router-dom';
import { FileText, Database, Shield, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const DARK = '#0F172A';

export default function AppSidebar() {
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const navItemClass = (active: boolean) =>
    cn(
      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
      active ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
    );

  return (
    <aside className="hidden sm:flex flex-col w-56 shrink-0 h-screen sticky top-0 bg-card border-r border-border">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 p-1" style={{ backgroundColor: DARK }}>
          <img src="/megasteam-logo.png" alt="Megasteam" className="max-w-full max-h-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground truncate">Megasteam</p>
          <p className="text-[10px] text-muted-foreground tracking-wide uppercase truncate">One Page Report</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <Link to="/" className={navItemClass(isActive('/'))}>
          <FileText className="h-4 w-4 shrink-0" />
          Relatório
        </Link>
        <Link to="/dados" className={navItemClass(isActive('/dados'))}>
          <Database className="h-4 w-4 shrink-0" />
          Dados
        </Link>

        {isAdmin && (
          <>
            <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
              Administração
            </p>
            <Link to="/admin" className={navItemClass(isActive('/admin'))}>
              <Shield className="h-4 w-4 shrink-0" />
              Admin
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground truncate mb-1.5">{user?.email}</p>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </div>
    </aside>
  );
}
