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
  num_turnos: number;
}

export type CheckinTipo = 'checkin' | 'checkout';

export interface OpsCheckin {
  id: string;
  obra_id: string;
  data: string;
  turno: number;
  tipo: CheckinTipo;
  horario: string;
  encarregado_email: string;
  encarregado_nome: string;
  atividades: string;
  observacoes: string;
}

export const OPS_ROLES: OpsRole[] = ['Admin', 'Gestor', 'Engenheiro', 'Encarregado'];

export type SolicitacaoStatus = 'pendente' | 'aprovado' | 'rejeitado';

export interface OpsSolicitacao {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  obra_interesse: string;
  role_desejado: 'Encarregado' | 'Engenheiro' | 'Gestor';
  status: SolicitacaoStatus;
  created_at: string;
}
