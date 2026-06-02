export type OpsRole = 'Admin' | 'Gestor' | 'Engenheiro' | 'Encarregado';

export interface OpsUser {
  id: string;
  email: string;
  nome: string;
  role: OpsRole;
  obra_id: string | null;
}

export interface OpsObra {
  id: string;
  nome: string;
  cliente: string;
  contrato: string;
  data_inicio: string | null;
  data_termino: string | null;
  status: 'ativa' | 'encerrada';
  gestor_responsavel: string;
}

export const OPS_ROLES: OpsRole[] = ['Admin', 'Gestor', 'Engenheiro', 'Encarregado'];
