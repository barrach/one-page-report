import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FileText, Database, Shield, Plus, LogOut } from 'lucide-react';
import { useState } from 'react';
import logo from '@/assets/megasteam-logo.png.asset.json';
import { useAuth } from '@/hooks/use-auth';
import { useProjectStore } from '@/store/projectStore';
import ProjectSelector from '@/components/ProjectSelector';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Props {
  /** Extra actions rendered before the project selector (export, theme, etc.) */
  actions?: React.ReactNode;
}

const AppNavbar = ({ actions }: Props) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const addProject = useProjectStore((s) => s.addProject);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const tab = (to: string, icon: React.ReactNode, label: string) => {
    const active = pathname === to;
    return (
      <Link
        key={to}
        to={to}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          active
            ? 'bg-primary-foreground/20 text-primary-foreground font-semibold'
            : 'text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10'
        }`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
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
    <header className="gradient-primary sticky top-0 z-50 px-3 sm:px-5 py-2.5 card-shadow-elevated print:hidden">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <img src={logo.url} alt="MEGASTEAM" className="h-7 sm:h-8 w-auto object-contain" />
          <div className="hidden sm:block h-6 w-px bg-primary-foreground/20" />
          <nav className="flex items-center gap-1">
            {tab('/', <FileText className="h-3.5 w-3.5" />, 'Relatório')}
            {tab('/dados', <Database className="h-3.5 w-3.5" />, 'Dados')}
            {isAdmin && tab('/admin', <Shield className="h-3.5 w-3.5" />, 'Admin')}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {actions}
          <ProjectSelector />
          {isAdmin &&
            (showNew ? (
              <div className="flex items-center gap-1">
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Nome do contrato"
                  className="h-8 w-40 text-xs bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
                />
                <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={handleCreate}>
                  Criar
                </Button>
                <button
                  className="h-8 px-2 text-xs text-primary-foreground/70 hover:text-primary-foreground"
                  onClick={() => setShowNew(false)}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNew(true)}
                title="Novo contrato"
                className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-medium text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">Novo</span>
              </button>
            ))}
          <button
            onClick={async () => {
              await signOut();
              navigate('/login');
            }}
            title={user?.email ? `Sair (${user.email})` : 'Sair'}
            aria-label="Sair"
            className="flex items-center justify-center h-8 w-8 rounded-lg text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppNavbar;
