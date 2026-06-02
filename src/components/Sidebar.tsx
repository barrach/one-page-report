import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart2, Activity, Wallet, TrendingUp, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_AVATAR_BG, type Module } from '@/types/auth';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  module?: Module;
  match: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { to: '/',              label: 'Home',            icon: Home,       match: p => p === '/' },
  { to: '/opr',           label: 'One Page Report', icon: BarChart2,  module: 'opr',           match: p => p.startsWith('/opr') },
  { to: '/prodcontrol',   label: 'ProdControl',     icon: Activity,   module: 'prodcontrol',   match: p => p.startsWith('/prodcontrol') },
  { to: '/budget',        label: 'MegaPricing',     icon: Wallet,     module: 'megapricing',   match: p => p.startsWith('/budget') },
  { to: '/controladoria', label: 'Controladoria',   icon: TrendingUp, module: 'controladoria', match: p => p.startsWith('/controladoria') },
];

const ICON_ACTIVE = '#ffffff';
const ICON_INACTIVE = '#94A3B8';

const IconLink = ({ item, active }: { item: NavItem; active: boolean }) => {
  const Icon = item.icon;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <Link
          to={item.to}
          className="flex items-center justify-center h-10 w-10 rounded-lg transition-colors"
          style={{ backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent' }}
          aria-label={item.label}
        >
          <Icon className="h-5 w-5" style={{ color: active ? ICON_ACTIVE : ICON_INACTIVE }} />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
};

export default function Sidebar() {
  const { user, email, role, isAdmin, hasModule, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null; // não exibe na tela de login

  const path = location.pathname;
  const visible = NAV.filter(n => !n.module || hasModule(n.module));
  const avatarBg = role ? ROLE_AVATAR_BG[role] : 'bg-gray-500';
  const initial = (email ?? '?').charAt(0).toUpperCase();

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-14 flex flex-col items-center py-3 z-50"
      style={{ backgroundColor: '#0F172A' }}
    >
      {/* Topo — logo */}
      <Link to="/" className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center mb-4 shrink-0" aria-label="MegaHub">
        <span className="text-white font-black text-lg leading-none">M</span>
      </Link>

      {/* Meio — navegação */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {visible.map(item => (
          <IconLink key={item.to} item={item} active={item.match(path)} />
        ))}
      </nav>

      {/* Rodapé */}
      <div className="flex flex-col items-center gap-2 mt-2 shrink-0">
        {isAdmin && (
          <IconLink
            item={{ to: '/admin', label: 'Configurações', icon: Settings, match: p => p.startsWith('/admin') }}
            active={path.startsWith('/admin')}
          />
        )}

        {/* Avatar */}
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <div className={`h-8 w-8 rounded-full ${avatarBg} flex items-center justify-center text-white font-bold text-xs cursor-default`}>
              {initial}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">{email}</TooltipContent>
        </Tooltip>

        {/* Logout */}
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <button
              onClick={async () => { await signOut(); navigate('/login', { replace: true }); }}
              className="flex items-center justify-center h-10 w-10 rounded-lg transition-colors hover:bg-white/10"
              aria-label="Sair"
            >
              <LogOut className="h-5 w-5" style={{ color: ICON_INACTIVE }} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Sair</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
