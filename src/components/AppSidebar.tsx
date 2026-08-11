import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Database, Shield, LogOut, Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const DARK = '#0F172A';

export default function AppSidebar() {
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();
  const addProject = useProjectStore((s) => s.addProject);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('opr_sidebar_collapsed') === '1');
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('opr_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  const handleCreate = () => {
    const name = newName.trim().toUpperCase();
    if (!name) return;
    addProject(name);
    setNewName('');
    setNewOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;

  const itemClass = (active = false) =>
    cn(
      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full',
      collapsed && 'justify-center px-0',
      active ? 'bg-white/10 text-white font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5'
    );

  return (
    <aside
      className={cn(
        'hidden sm:flex flex-col shrink-0 h-screen sticky top-0 transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
      style={{ backgroundColor: DARK }}
    >
      {/* Brand */}
      <div className={cn('flex items-center gap-2.5 px-4 py-4 border-b border-white/10', collapsed && 'justify-center px-2')}>
        {!collapsed && (
          <>
            <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 p-1 bg-white/10">
              <img src="/megasteam-logo.png" alt="Megasteam" className="max-w-full max-h-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate">Megasteam</p>
            </div>
          </>
        )}
        <button
          onClick={toggleCollapsed}
          className="h-7 w-7 flex items-center justify-center rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <Link to="/" className={itemClass(isActive('/'))} title="Relatório">
          <FileText className="h-4 w-4 shrink-0" />
          {!collapsed && 'Relatório'}
        </Link>
        <Link to="/dados" className={itemClass(isActive('/dados'))} title="Dados">
          <Database className="h-4 w-4 shrink-0" />
          {!collapsed && 'Dados'}
        </Link>

        {isAdmin && (
          <>
            {!collapsed && (
              <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-white/40 tracking-widest uppercase">
                Administração
              </p>
            )}
            <Link to="/admin" className={itemClass(isActive('/admin'))} title="Admin">
              <Shield className="h-4 w-4 shrink-0" />
              {!collapsed && 'Admin'}
            </Link>
          </>
        )}

        <button onClick={() => setNewOpen(true)} className={cn(itemClass(), 'mt-4')} title="Novo projeto">
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && 'Novo'}
        </button>
      </nav>

      {/* Footer */}
      <div className={cn('px-4 py-3 border-t border-white/10', collapsed && 'px-2 flex flex-col items-center')}>
        {!collapsed && <p className="text-xs text-white/50 truncate mb-1.5">{user?.email}</p>}
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors"
          title="Sair"
        >
          <LogOut className="h-3.5 w-3.5" />
          {!collapsed && 'Sair'}
        </button>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nome do projeto"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
