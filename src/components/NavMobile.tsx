import { Link, useLocation } from 'react-router-dom';
import { Database, FileText, Layers, LogOut, Settings, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

/**
 * Os destinos do app, no celular.
 *
 * A navegação do desktop é a barra lateral, e ela é `hidden sm:flex`: no
 * celular ela simplesmente não existe. Sem esta lista, telas como o
 * consolidado só eram alcançáveis digitando a URL na mão — e quem chegava
 * nelas não tinha como voltar.
 */
export default function NavMobile({ aoNavegar }: { aoNavegar?: () => void }) {
  const { user, isAdmin, canEdit, signOut } = useAuth();
  const { pathname } = useLocation();

  // A mesma ordem da barra lateral: a leitura começa no cliente e só depois
  // desce para a obra. Duas ordens diferentes fariam parecer dois menus.
  const destinos = [
    { para: '/consolidado', rotulo: 'Consolidado', Icone: Layers, visivel: true },
    { para: '/', rotulo: 'Relatório', Icone: FileText, visivel: true },
    { para: '/dados', rotulo: 'Dados', Icone: Database, visivel: canEdit },
    { para: '/configuracoes', rotulo: 'Configurações', Icone: Settings, visivel: true },
    { para: '/admin', rotulo: 'Admin', Icone: Shield, visivel: isAdmin },
  ].filter((d) => d.visivel);

  return (
    <div className="flex flex-col gap-1">
      {destinos.map(({ para, rotulo, Icone }) => (
        <Link
          key={para}
          to={para}
          onClick={aoNavegar}
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 h-11 text-sm font-medium transition-colors',
            pathname === para
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-foreground hover:bg-muted',
          )}
        >
          <Icone className="h-4 w-4 shrink-0" />
          {rotulo}
        </Link>
      ))}

      <div className="mt-2 pt-2 border-t border-border">
        {user?.email && (
          <p className="px-3 pb-1.5 text-xs text-muted-foreground truncate">{user.email}</p>
        )}
        <button
          onClick={() => { aoNavegar?.(); signOut(); }}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 h-11 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sair
        </button>
      </div>
    </div>
  );
}
