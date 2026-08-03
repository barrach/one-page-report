import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FileText, Database, Shield, Plus, LogOut, Tv } from 'lucide-react';
import { useState } from 'react';
import logo from '@/assets/megasteam-logo.png.asset.json';
import { useAuth } from '@/hooks/use-auth';
import { useProjectStore } from '@/store/projectStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const itemBase =
  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors';

const AppSidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const addProject = useProjectStore((s) => s.addProject);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const link = (to: string, icon: React.ReactNode, label: string) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className={`${itemBase} ${
          active
            ? 'bg-primary-foreground/20 text-primary-foreground font-semibold'
            : 'text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10'
        }`}
      >
        {icon}
        {label}
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
    <aside className="hidden sm:flex flex-col w-56 shrink-0 gradient-primary sticky top-0 h-screen px-3 py-4 print:hidden">
      <div className="px-2 pb-4">
        <img src={logo.url} alt="MEGASTEAM" className="h-10 w-auto object-contain" />
      </div>

      <nav className="flex flex-col gap-1">
        {link('/', <FileText className="h-3.5 w-3.5" />, 'Relatório')}
        {link('/dados', <Database className="h-3.5 w-3.5" />, 'Dados')}
        {link('/tv', <Tv className="h-3.5 w-3.5" />, 'Modo TV')}

        {isAdmin && (
          <>
            <div className="mt-4 mb-1 px-3 text-[10px] uppercase tracking-widest text-primary-foreground/40">
              Administração
            </div>
            {link('/admin', <Shield className="h-3.5 w-3.5" />, 'Admin')}
            {showNew ? (
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
                onClick={() => setShowNew(true)}
                className={`${itemBase} text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10`}
              >
                <Plus className="h-3.5 w-3.5" /> Novo
              </button>
            )}
          </>
        )}
      </nav>

      <div className="mt-auto pt-4 border-t border-primary-foreground/20">
        <p className="px-3 text-[10px] text-primary-foreground/50 truncate">{user?.email}</p>
        <button
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          className={`${itemBase} w-full text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10`}
        >
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
