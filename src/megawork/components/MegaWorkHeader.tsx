import { useNavigate } from 'react-router-dom';
import { HardHat, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMegaWorkAuth } from '@megawork/context/MegaWorkAuthContext';

export default function MegaWorkHeader() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { opsUser } = useMegaWorkAuth();

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-[#0F172A] flex items-center justify-center">
          <HardHat className="h-4 w-4 text-blue-400" />
        </div>
        <div className="leading-tight">
          <span className="block text-sm font-black text-foreground">MegaWork</span>
          <span className="block text-[10px] text-muted-foreground">Gestão de campo</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao Hub
        </button>
        <div className="text-right leading-tight hidden sm:block">
          <span className="block text-xs font-semibold text-foreground">{opsUser?.nome || opsUser?.email}</span>
          <span className="block text-[10px] text-muted-foreground">{opsUser?.role}</span>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:opacity-80 transition-opacity"
          title="Sair"
        >
          <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
