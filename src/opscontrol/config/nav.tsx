import {
  LayoutDashboard, Home, Building2, LogIn, ShieldCheck, ListChecks,
  AlertTriangle, CalendarRange, TrendingUp, Users, GitBranch,
  NotebookPen, Lightbulb, UserCog, Settings,
} from 'lucide-react';
import type { OpsRole } from '@opscontrol/types';

export interface OpsNavItem {
  key: string;
  label: string;
  path: string;       // relativo a /opscontrol
  icon: typeof Home;
  roles: OpsRole[];   // perfis que veem o item (Admin sempre vê tudo)
}

export const OPS_NAV: OpsNavItem[] = [
  { key: 'dashboard',  label: 'Dashboard',           path: '',                     icon: LayoutDashboard, roles: ['Gestor', 'Engenheiro'] },
  { key: 'inicio',     label: 'Início',              path: 'inicio',               icon: Home,            roles: ['Encarregado'] },
  { key: 'obras',      label: 'Obras',               path: 'obras',                icon: Building2,       roles: ['Gestor', 'Engenheiro'] },
  { key: 'checkin',    label: 'Check-in/Check-out',  path: 'checkin',              icon: LogIn,           roles: ['Encarregado'] },
  { key: 'dds',        label: 'DDS',                 path: 'dds',                  icon: ShieldCheck,     roles: ['Encarregado'] },
  { key: 'atividades', label: 'Atividades',          path: 'atividades',           icon: ListChecks,      roles: ['Engenheiro', 'Encarregado'] },
  { key: 'restricoes', label: 'Restrições',          path: 'restricoes',           icon: AlertTriangle,   roles: ['Engenheiro', 'Encarregado'] },
  { key: 'cronograma', label: 'Importar Cronograma', path: 'importar-cronograma',  icon: CalendarRange,   roles: ['Gestor'] },
  { key: 'curvas',     label: 'Importar Curva S',    path: 'importar-curva-s',     icon: TrendingUp,      roles: ['Gestor'] },
  { key: 'reunioes',   label: 'Reuniões',            path: 'reunioes',             icon: Users,           roles: ['Gestor', 'Engenheiro'] },
  { key: 'puxado',     label: 'Planejamento Puxado', path: 'planejamento-puxado',  icon: GitBranch,       roles: ['Gestor'] },
  { key: 'rdo',        label: 'Anotações/RDO',       path: 'rdo',                  icon: NotebookPen,     roles: ['Engenheiro', 'Encarregado'] },
  { key: 'licoes',     label: 'Lições Aprendidas',   path: 'licoes',               icon: Lightbulb,       roles: ['Gestor', 'Engenheiro'] },
  { key: 'usuarios',   label: 'Usuários',            path: 'usuarios',             icon: UserCog,         roles: [] }, // só Admin
  { key: 'config',     label: 'Configurações',       path: 'configuracoes',        icon: Settings,        roles: [] }, // só Admin
];

export const navForRole = (role: OpsRole | null): OpsNavItem[] => {
  if (!role) return [];
  if (role === 'Admin') return OPS_NAV;
  return OPS_NAV.filter(i => i.roles.includes(role));
};
