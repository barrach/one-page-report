import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FileText, Database, Shield, Plus, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import logo from '@/assets/megasteam-logo.png.asset.json';
import { useAuth } from '@/hooks/use-auth';
import { useProjectStore } from '@/store/projectStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const itemBase =
  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors';

const STORAGE_KEY = 'opr-sidebar-collapsed';

const AppSidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const addProject = useProjectStore((s) => s.addProject);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [collapsed, setCollapsed] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) === '1'
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    if (collapsed) setShowNew(false);
  }, [collapsed]);

  const link = (to: string, icon: React.ReactNode, label: string) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        title={label}
        className={`${itemBase} ${collapsed ? 'justify-center px-0' : ''} ${
          active
            ? 'bg-primary-foreground/20 text-primary-foreground font-semibold'
            : 'text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10'
        }`}
      >
        {icon}
        {!collapsed && label}
      </Link>
    );
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await addProject(newName.trim().toUpperCase());
    setNewName('');
    setShowNew(false);
  };

  return (
    <aside
      className={`hidden sm:flex flex-col shrink-0 gradient-primary sticky top-0 h-screen px-3 py-4 print:hidden transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      <div className={`flex items-center gap-2 pb-4 ${collapsed ? 'justify-center' : 'px-2 justify-between'}`}>
        {!collapsed && <img src={logo.url} alt="MEGASTEAM" className="h-10 w-auto object-contain" />}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="p-1.5 rounded-md text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {link('/', <FileText className="h-3.5 w-3.5" />, 'Relatório')}
        {link('/dados', <Database className="h-3.5 w-3.5" />, 'Dados')}

        {isAdmin && (
          <>
            {!collapsed && (
              <div className="mt-4 mb-1 px-3 text-[10px] uppercase tracking-widest text-primary-foreground/40">
                Administração
              </div>
            )}
            {collapsed && <div className="mt-4 mb-1 mx-auto w-6 border-t border-primary-foreground/20" />}
            {link('/admin', <Shield className="h-3.5 w-3.5" />, 'Admin')}
            {showNew && !collapsed ? (
              <div className="px-1 py-1 space-y-1">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Nome do contrato"
                  className="h-8 text-xs bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                />
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" className="h-7 flex-1 text-xs" onClick={handleCreate}>
                    Criar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-primary-foreground"
                    onClick={() => setShowNew(false)}
                  >
                    ✕
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setCollapsed(false);
                  setShowNew(true);
                }}
                title="Novo contrato"
                className={`${itemBase} ${collapsed ? 'justify-center px-0' : ''} text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10`}
              >
                <Plus className="h-3.5 w-3.5" /> {!collapsed && 'Novo'}
              </button>
            )}
          </>
        )}
      </nav>

      <div className="mt-auto pt-4 border-t border-primary-foreground/20">
        {!collapsed && (
          <p className="px-3 text-[10px] text-primary-foreground/50 truncate">{user?.email}</p>
        )}
        <button
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          title="Sair"
          className={`${itemBase} w-full ${collapsed ? 'justify-center px-0' : ''} text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10`}
        >
          <LogOut className="h-3.5 w-3.5" /> {!collapsed && 'Sair'}
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
