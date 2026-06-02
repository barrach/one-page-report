// ════════════════════════════════════════════════════════════════════════
// MegaHub — definições de módulos, roles e seed de permissões
// O seed também serve de FALLBACK caso a tabela user_permissions ainda não
// esteja acessível (ex.: migration ainda não aplicada).
// ════════════════════════════════════════════════════════════════════════

export type ModuleId = 'megapricing' | 'controladoria' | 'prodcontrol' | 'opr';
export type Role = 'admin' | 'diretor' | 'orcamento' | 'obra' | 'cliente';

export const ADMIN_EMAIL = 'michel.zabalia@megasteam.com.br';

export const ALL_MODULES: { id: ModuleId; label: string }[] = [
  { id: 'megapricing',   label: 'MegaPricing' },
  { id: 'controladoria', label: 'Controladoria' },
  { id: 'prodcontrol',   label: 'ProdControl' },
  { id: 'opr',           label: 'One Page Report' },
];

export const ROLES: { id: Role; label: string }[] = [
  { id: 'admin',     label: 'Admin' },
  { id: 'diretor',   label: 'Diretor' },
  { id: 'orcamento', label: 'Orçamento' },
  { id: 'obra',      label: 'Obra' },
  { id: 'cliente',   label: 'Cliente' },
];

export interface UserPermission {
  email: string;
  role: Role;
  modules: ModuleId[];
}

const ALL: ModuleId[] = ['megapricing', 'controladoria', 'prodcontrol', 'opr'];

// Mapa de módulo → rota do hub
export const MODULE_ROUTE: Record<ModuleId, string> = {
  megapricing: '/budget',
  controladoria: '/controladoria',
  prodcontrol: '/prodcontrol',
  opr: '/opr',
};

// Mapa de prefixo de rota → módulo necessário (para proteção de rotas)
export const ROUTE_MODULE: { prefix: string; module: ModuleId }[] = [
  { prefix: '/budget', module: 'megapricing' },
  { prefix: '/controladoria', module: 'controladoria' },
  { prefix: '/prodcontrol', module: 'prodcontrol' },
  { prefix: '/opr', module: 'opr' },
];

// SEED — mesma lista da migration. Fallback quando a tabela não responde.
export const SEED_PERMISSIONS: UserPermission[] = [
  { email: 'michel.zabalia@megasteam.com.br',      role: 'admin',     modules: ALL },
  { email: 'paulo.araujo@megasteam.com.br',        role: 'diretor',   modules: ALL },
  { email: 'thiago.cellular@megasteam.com.br',     role: 'diretor',   modules: ALL },
  { email: 'alexsandro.stolarski@megasteam.com.br',role: 'diretor',   modules: ALL },
  { email: 'beatriz.romeu@megasteam.com.br',       role: 'orcamento', modules: ['megapricing'] },
  { email: 'sirlaine.meira@megasteam.com.br',      role: 'orcamento', modules: ['megapricing'] },
  { email: 'jefferson.figueiredo@megasteam.com.br',role: 'orcamento', modules: ['megapricing'] },
  { email: 'maiara.silva@megasteam.com.br',        role: 'orcamento', modules: ['megapricing'] },
  { email: 'edmilson.netto@megasteam.com.br',      role: 'obra',      modules: ['prodcontrol', 'opr'] },
  { email: 'robinson.amaral@megasteam.com.br',     role: 'obra',      modules: ['prodcontrol', 'opr'] },
  { email: 'pedro.melecardi@megasteam.com.br',     role: 'obra',      modules: ['prodcontrol', 'opr'] },
  { email: 'pedro.rosa@megasteam.com.br',          role: 'obra',      modules: ['prodcontrol', 'opr'] },
  { email: 'anderson.melo@megasteam.com.br',       role: 'obra',      modules: ['prodcontrol', 'opr'] },
  { email: 'lucas.albuquerque@megasteam.com.br',   role: 'obra',      modules: ['prodcontrol', 'opr'] },
  { email: 'perene@megasteam.com.br',              role: 'cliente',   modules: ['opr'] },
];

export const seedFor = (email: string): UserPermission | null =>
  SEED_PERMISSIONS.find(p => p.email.toLowerCase() === email.toLowerCase()) ?? null;

export const isAdminEmail = (email?: string | null) =>
  !!email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
