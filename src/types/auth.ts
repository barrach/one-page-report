export type UserRole = 'admin' | 'diretor' | 'orcamento' | 'obra' | 'cliente';
export type Module = 'megapricing' | 'controladoria' | 'prodcontrol' | 'opr';

export interface UserPermission {
  id: string;
  email: string;
  role: UserRole;
  modules: Module[];
}

export const ALL_MODULES: { id: Module; label: string }[] = [
  { id: 'megapricing',   label: 'MegaPricing' },
  { id: 'controladoria', label: 'Controladoria' },
  { id: 'prodcontrol',   label: 'ProdControl' },
  { id: 'opr',           label: 'One Page Report' },
];

export const ALL_ROLES: UserRole[] = ['admin', 'diretor', 'orcamento', 'obra', 'cliente'];

// Cor do avatar por role
export const ROLE_AVATAR_BG: Record<UserRole, string> = {
  admin:     'bg-purple-600',
  diretor:   'bg-blue-600',
  obra:      'bg-green-600',
  orcamento: 'bg-orange-500',
  cliente:   'bg-gray-500',
};

// Badge colorido por role
export const ROLE_BADGE: Record<UserRole, string> = {
  admin:     'bg-purple-100 text-purple-700',
  diretor:   'bg-blue-100 text-blue-700',
  obra:      'bg-green-100 text-green-700',
  orcamento: 'bg-orange-100 text-orange-700',
  cliente:   'bg-gray-100 text-gray-700',
};
