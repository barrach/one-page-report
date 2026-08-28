import { create } from 'zustand';
// DADOS do OPR vêm do projeto original bxmvz (FRIGO, NTS, OXICORTE, GUAXE...).
// A autenticação fica no client principal (rlpmw); aqui é só leitura/escrita de dados.
import { oprDataClient as supabase } from '@/integrations/supabase/oprDataClient';
import type { ItemLayoutRelatorio } from '@/lib/layoutRelatorio';
import type { ColunaCronograma } from '@/lib/parseCronogramaColado';
import type { Evidencia } from '@/lib/evidencias';
import type { ItemEapFinanceira, ColunaEap } from '@/lib/eapFinanceira';
import { acessoRestrito, melhorPapel, obrasVisiveis, type AppRole } from '@/lib/acesso';
import type { ProgramacaoSemanal, AtividadeProgSemanal, Causa6M } from '../lib/parseProgramacaoSemanal';
export type { ProgramacaoSemanal, AtividadeProgSemanal, Causa6M };

export interface ProjectInfo {
  projeto: string;
  cliente: string;
  gestor: string;
  inicio: string;
  terminoLB: string;
  terminoPrev: string;
  avancoPrev: number;
  avancoReal: number;
  atualizadoEm: string;
  /** ISO timestamp do último "Salvar alterações" das Informações do Projeto */
  infoSavedAt?: string;
  contrato?: string;
  escopo?: string;
  /** Quem planeja a obra. */
  planejador?: string;
  /** Semana de análise da reunião — ex.: "SEM 32" ou "26-SEM32". */
  semanaAnalise?: string;
  /** Natureza da obra (montagem eletromecânica, caldeiraria, parada...). */
  tipoObra?: string;
  /** Custo de execução da obra em R$ — o que a Megasteam gasta. */
  custoObra?: number;
  /** Valor do contrato em R$ — usado quando a EAP financeira não tem valor. */
  valorContrato?: number;
  /** Alíquota de impostos sobre a receita, em % — entra no resultado projetado. */
  impostoPercentual?: number;
  // ── Correções feitas direto no consolidado ──
  // Valem sobre o que a EAP soma: a linha do consolidado é onde o erro aparece,
  // e obrigar a voltar na EAP para corrigir um número que está na sua frente é
  // o caminho mais curto para ninguém corrigir.
  /** Medição acumulada lançada à mão. */
  acumuladoManual?: number;
  /** Previsto de medição do mês lançado à mão. */
  previstoMesManual?: number;
  /** Realizado de medição do mês lançado à mão. */
  realizadoMesManual?: number;
  // ── Curva S vinda do MS Project (Trabalho ou Custo acumulado) ──
  /** Em que unidade o Project exportou a curva. */
  curvaBase?: 'trabalho' | 'custo';
  /** Data do primeiro ponto da curva (ISO yyyy-mm-dd) — o início da obra. */
  curvaInicio?: string;
  /** De quanto em quanto tempo a curva avança: 7 dias ou dia a dia. */
  curvaPeriodicidade?: 'semanal' | 'diaria';
  /** Contra o que o card Prev. × Realizado Mês compara o mês. */
  mesBase?: 'linhaBase' | 'tendencia';
  /** Recorte do Histograma MOD no relatório: obra inteira, 15 ou 30 dias. */
  histPeriodo?: 'tudo' | '15' | '30';
  // ── Clima da obra ──
  /** Cidade escolhida, como aparece no card. */
  climaLocal?: string;
  climaLat?: number;
  climaLon?: number;
  // FORMATO D — autoritative KPI values (em % already, ex.: 87 = 87%)
  prevSemana?: number;
  realSemana?: number;
  desvioSemana?: number;
  prevAcumulado?: number;
  realAcumulado?: number;
  desvioAcumulado?: number;
  previstoProxSemana?: number;
}

export interface WeekData {
  date: string;
  previsto: number;
  real: number;
  /** Tendência semanal (Formato C) */
  tendencia?: number;
  /** Semana de status (centro da janela) — usada para destaque visual */
  isStatus?: boolean;
}

export interface SCurvePoint {
  date: string;
  previsto: number;
  real: number;
  tendencia: number;
  replanejado?: number;
  /** Real Replanejado (acumulado após replanejamento — série separada) */
  realReplanejado?: number;
}

export interface SCurveSettings {
  showReplanejado: boolean;
}

export interface MonthWeekData {
  label: string;
  previsto: number;
  real: number;
}

export type ActionStatus = 'NÃO INICIADO' | 'EM ANDAMENTO' | 'CONCLUÍDO' | 'CANCELADO' | 'ATRASADO' | '';

export interface ActionItem {
  id: number;
  problema: string;
  causa: string;
  impacto: string;
  atividade: string;
  responsavel: string;
  prazo: string;
  necessidade: string;
  status: ActionStatus;
}

export interface Observation {
  id: number;
  text: string;
  date?: string;
}

/**
 * Anotação feita num card do relatório, durante a reunião.
 *
 * Guarda a data de quando foi escrita — é isso que transforma o card num
 * histórico do que foi dito naquela semana, em vez de um texto que alguém
 * sobrescreve na semana seguinte.
 */
export interface ObservacaoCard {
  id: string;
  texto: string;
  /** ISO de quando foi registrada. */
  data: string;
  autor?: string;
}

export interface HistogramPoint {
  date: string;
  semana: string;
  /** MOD prevista. O nome ficou curto por compatibilidade com o que já está salvo. */
  previsto: number;
  /** MOD real. */
  real: number;
  /** MOD replanejada — série separada, preenchida quando há replanejamento. */
  replanejado?: number;
  /** MOI — indireta: encarregado, técnico de segurança, apontador, almoxarife. */
  moiPrevisto?: number;
  moiReal?: number;
  moiReplanejado?: number;
}

export interface CurvaSFinanceiraPoint {
  date: string; // ISO yyyy-mm-dd
  previsto: number;
  real: number;
  prevAcum: number;
  realAcum: number;
}

export interface ScheduleRow {
  id: string;
  tarefa: string;
  /** % LB Prevista */
  previsto: number;
  /** % Real */
  trabalhoConcluido: number;
  desvio: number;
  /** Legado: a data "corrente" — nas importações do template é a Previsão. */
  inicio: string;
  termino: string;
  inicioBase: string;
  terminoBase: string;
  // ─── Colunas do "Template - Cronograma" ───
  status?: string;
  critica?: boolean;
  duracaoReal?: string;
  duracaoRestante?: string;
  inicioReal?: string;
  previsaoInicio?: string;
  terminoReal?: string;
  previsaoTermino?: string;
  custo?: number;
  highlight?: boolean;
  bold?: boolean;
  criticalPath?: boolean;
  outlineLevel?: number;
  outlineNumber?: string;
  summary?: boolean;
  milestone?: boolean;
  /** Texto cru de cada coluna importada, por chave — o relatorio mostra isto. */
  celulas?: Record<string, string>;
}

export type DesvioCausaRaiz = 'Mão de Obra' | 'Material' | 'Equipamento' | 'Clima' | 'Escopo' | 'Projeto' | 'Outro' | '';
export type DesvioImpactoPrazo = 'sem_impacto' | 'risco' | 'confirmado' | '';

export interface DesvioAnalise {
  /** sinal do desvio quando foi salvo: 'atraso' | 'adiantamento' — para resetar ao trocar de sinal */
  tipo: 'atraso' | 'adiantamento' | '';
  causaRaiz: DesvioCausaRaiz;
  descricao: string;
  impactoPrazo: DesvioImpactoPrazo;
  acaoCorretiva: string;
  prazoResposta: string;
  responsavel: string;
  /** ISO timestamp do último salvamento */
  savedAt?: string;
}

/**
 * Análise de risco do consolidado, escrita pela equipe (com ou sem ajuda da IA).
 *
 * Vive no projeto e não numa tabela de clientes porque cliente não é entidade
 * no banco — é um campo de texto da obra. Ela é gravada em TODAS as obras do
 * cliente, como o layout do relatório já faz, e lida da mais recente.
 */
export interface NotaDeTexto {
  texto: string;
  /** ISO de quando foi salva — é ela que decide qual cópia vale. */
  atualizadoEm: string;
  autor?: string;
  /** Veio da IA e ainda não foi editada por gente. */
  porIa?: boolean;
}
/**
 * Um motivo de desvio anotado no consolidado.
 *
 * Lista, e não campo único: a reunião levanta um motivo por vez, e sobrescrever
 * o anterior apagaria o histórico do mês — que é justamente o que se quer ler
 * depois.
 */
export interface MotivoDesvio {
  id: string;
  texto: string;
  /** ISO de quando foi registrado. */
  data: string;
  autor?: string;
}

/** Nome antigo, mantido porque a análise de risco já referencia este tipo. */
export type RiscoConsolidado = NotaDeTexto;


export interface Project {
  id: string;
  name: string;
  info: ProjectInfo;
  statusDateIndex: number;
  weeklyData: WeekData[];
  sCurveData: SCurvePoint[];
  monthData: MonthWeekData[];
  actions: ActionItem[];
  observations: Observation[];
  histogramData: HistogramPoint[];
  scheduleData: ScheduleRow[];
  /** Colunas do cronograma como vieram da importacao, na ordem do arquivo. */
  scheduleColunas?: ColunaCronograma[];
  /** Fotos de evidencia da obra — ponteiro para o Storage + legenda. */
  evidencias?: Evidencia[];
  /** EAP financeira do contrato: valor, previsto, realizado e acumulado. */
  eapFinanceira?: ItemEapFinanceira[];
  /** Colunas da EAP financeira como vieram da colagem. */
  eapColunas?: ColunaEap[];
  curvaSFinanceira?: CurvaSFinanceiraPoint[];
  aiInsights?: Record<string, string>; // chartType -> insight text
  /** Arrumação dos cards do relatório — do projeto, não de quem olha. */
  layoutRelatorio?: ItemLayoutRelatorio[];
  /** Arrumação dos blocos do consolidado — igual para todas as obras. */
  layoutConsolidado?: ItemLayoutRelatorio[];
  /** Anotações de reunião por card do relatório: chave do card → histórico. */
  observacoesCards?: Record<string, ObservacaoCard[]>;
  lastImports?: { sCurve?: string; weekly?: string; month?: string; histogram?: string; schedule?: string; curvaSFinanceira?: string; progSemanal?: string };
  programacaoSemanal?: ProgramacaoSemanal[];
  desvioAnalise?: DesvioAnalise;
  /** Análise de risco do consolidado do cliente — a mesma em todas as obras dele. */
  riscoConsolidado?: RiscoConsolidado;
  /** Títulos das perguntas do consolidado, quando renomeadas. Iguais para todos. */
  titulosConsolidado?: Record<string, string>;
  /** Motivos do desvio do mês, anotados à mão no consolidado. */
  motivosDesvio?: MotivoDesvio[];
  /** @deprecated campo único anterior — a lista acima o absorve na leitura. */
  notaProblemas?: NotaDeTexto;
}

const defaultProjectData: Omit<Project, 'id' | 'name'> = {
  statusDateIndex: 0,
  info: {
    projeto: '',
    cliente: '',
    gestor: '',
    inicio: '',
    terminoLB: '',
    terminoPrev: '',
    avancoPrev: 0,
    avancoReal: 0,
    atualizadoEm: new Date().toISOString().split('T')[0],
  },
  weeklyData: [{ date: '', previsto: 0, real: 0 }],
  sCurveData: [{ date: '', previsto: 0, real: 0, tendencia: 0 }],
  monthData: [
    { label: 'Sem. 1', previsto: 0, real: 0 },
    { label: 'Sem. 2', previsto: 0, real: 0 },
    { label: 'Sem. 3', previsto: 0, real: 0 },
    { label: 'Sem. 4', previsto: 0, real: 0 },
    { label: 'Sem. 5', previsto: 0, real: 0 },
  ],
  actions: [
    { id: 1, problema: '', causa: '', impacto: '', atividade: '', responsavel: '', prazo: '', necessidade: '', status: '' as ActionStatus },
    { id: 2, problema: '', causa: '', impacto: '', atividade: '', responsavel: '', prazo: '', necessidade: '', status: '' as ActionStatus },
  ],
  observations: [{ id: 1, text: '' }],
  histogramData: [{ date: '', semana: '', previsto: 0, real: 0 }],
  scheduleData: [{ id: '', tarefa: '', previsto: 0, trabalhoConcluido: 0, desvio: 0, inicio: '', termino: '', inicioBase: '', terminoBase: '' }],
};

const createDefaultProject = (id: string, name: string): Project => ({
  id,
  name,
  ...defaultProjectData,
  info: { ...defaultProjectData.info, projeto: name },
});

// Seed project for new installations
const seedProject: Project = {
  id: 'guaxe',
  name: 'GUAXE',
  statusDateIndex: 1,
  info: {
    projeto: 'GUAXE',
    cliente: 'RHODIA',
    gestor: 'ANDRÉ CALANDRINI',
    inicio: '2025-11-26',
    terminoLB: '2026-07-05',
    terminoPrev: '2026-05-17',
    avancoPrev: 62.65,
    avancoReal: 33.0,
    atualizadoEm: '2026-02-17',
  },
  weeklyData: [
    { date: '28-Dec', previsto: 9.3, real: 15.21 },
    { date: '4-Jan', previsto: 16.34, real: 10 },
    { date: '11-Jan', previsto: 11.7, real: 0 },
    { date: '18-Jan', previsto: 9.41, real: 0 },
    { date: '25-Jan', previsto: 6.7, real: 0 },
    { date: '1-Feb', previsto: 4.28, real: 0 },
  ],
  sCurveData: [
    { date: '28-Dec', previsto: 9.3, real: 15.21, tendencia: 15.21 },
    { date: '4-Jan', previsto: 25.64, real: 25.21, tendencia: 25.21 },
    { date: '11-Jan', previsto: 37.34, real: 25.21, tendencia: 28.0 },
    { date: '18-Jan', previsto: 46.75, real: 25.21, tendencia: 32.0 },
    { date: '25-Jan', previsto: 53.45, real: 25.21, tendencia: 37.0 },
    { date: '1-Feb', previsto: 57.73, real: 25.21, tendencia: 42.0 },
  ],
  monthData: [
    { label: 'Sem. 1', previsto: 73.5, real: 0 },
    { label: 'Sem. 2', previsto: 80.3, real: 0 },
    { label: 'Sem. 3', previsto: 82.9, real: 0 },
    { label: 'Sem. 4', previsto: 87.4, real: 0 },
    { label: 'Sem. 5', previsto: 0, real: 0 },
  ],
  actions: [
    { id: 1, problema: '', causa: '', impacto: '', atividade: '', responsavel: '', prazo: '', necessidade: '', status: '' as ActionStatus },
    { id: 2, problema: '', causa: '', impacto: '', atividade: '', responsavel: '', prazo: '', necessidade: '', status: '' as ActionStatus },
    { id: 3, problema: '', causa: '', impacto: '', atividade: '', responsavel: '', prazo: '', necessidade: '', status: '' as ActionStatus },
    { id: 4, problema: '', causa: '', impacto: '', atividade: '', responsavel: '', prazo: '', necessidade: '', status: '' as ActionStatus },
  ],
  observations: [
    { id: 1, text: 'Fase 1 - com o término previsto para o dia 26/02' },
    { id: 2, text: '' },
    { id: 3, text: '' },
  ],
  histogramData: [{ date: '', semana: '', previsto: 0, real: 0 }],
  scheduleData: [{ id: '', tarefa: '', previsto: 0, trabalhoConcluido: 0, desvio: 0, inicio: '', termino: '', inicioBase: '', terminoBase: '' }],
};

// DB helpers
// ── localStorage (fallback/backup quando a tabela 'projects' não está acessível) ──
const LS_PROJECTS_KEY = 'opr_projects';
const loadProjectsLS = (): Project[] | null => {
  try {
    const raw = localStorage.getItem(LS_PROJECTS_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as Project[]) : null;
  } catch { return null; }
};
const saveProjectsLS = (projects: Project[]) => {
  try { localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(projects)); } catch { /* quota/ignore */ }
};

/**
 * Papel e obras liberadas para quem está logado.
 *
 * Vai ao banco em vez de esperar o AuthContext porque o carregamento das obras
 * roda na montagem do app, antes de o papel ter chegado — e liberar tudo "só
 * enquanto carrega" é exatamente a janela que o recorte existe para fechar.
 */
const lerAcessoDoUsuario = async (): Promise<{
  papel: AppRole | null;
  atribuidas: string[];
  falhou: boolean;
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { papel: null, atribuidas: [], falhou: false };

    const [papeis, atrib] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id),
      supabase.from('project_assignments').select('project_id').eq('user_id', user.id),
    ]);

    return {
      papel: melhorPapel((papeis.data ?? []).map((r) => String(r.role))),
      atribuidas: (atrib.data ?? []).map((a) => String(a.project_id)),
      falhou: Boolean(papeis.error || atrib.error),
    };
  } catch {
    return { papel: null, atribuidas: [], falhou: true };
  }
};

const dbToProject = (row: { id: string; name: string; data: Record<string, unknown> }): Project => {
  const d = row.data as Partial<Project>;
  return {
    id: row.id,
    name: row.name,
    statusDateIndex: d.statusDateIndex ?? 0,
    info: d.info ?? { ...defaultProjectData.info, projeto: row.name },
    weeklyData: d.weeklyData ?? defaultProjectData.weeklyData,
    sCurveData: d.sCurveData ?? defaultProjectData.sCurveData,
    monthData: d.monthData ?? defaultProjectData.monthData,
    actions: d.actions ?? defaultProjectData.actions,
    observations: d.observations ?? defaultProjectData.observations,
    histogramData: d.histogramData ?? defaultProjectData.histogramData,
    scheduleData: d.scheduleData ?? defaultProjectData.scheduleData,
    scheduleColunas: (d.scheduleColunas as ColunaCronograma[]) ?? undefined,
    evidencias: (d.evidencias as Evidencia[]) ?? [],
    eapFinanceira: (d.eapFinanceira as ItemEapFinanceira[]) ?? [],
    eapColunas: (d.eapColunas as ColunaEap[]) ?? undefined,
    curvaSFinanceira: (d.curvaSFinanceira as CurvaSFinanceiraPoint[]) ?? [],
    aiInsights: (d.aiInsights as Record<string, string>) ?? {},
    observacoesCards: (d.observacoesCards as Record<string, ObservacaoCard[]>) ?? {},
    layoutRelatorio: (d.layoutRelatorio as ItemLayoutRelatorio[]) ?? undefined,
    layoutConsolidado: (d.layoutConsolidado as ItemLayoutRelatorio[]) ?? undefined,
    lastImports: (d.lastImports as Project['lastImports']) ?? {},
    programacaoSemanal: (d.programacaoSemanal as ProgramacaoSemanal[]) ?? [],
    desvioAnalise: (d.desvioAnalise as DesvioAnalise) ?? undefined,
    riscoConsolidado: (d.riscoConsolidado as RiscoConsolidado) ?? undefined,
    notaProblemas: (d.notaProblemas as NotaDeTexto) ?? undefined,
    motivosDesvio: (d.motivosDesvio as MotivoDesvio[]) ?? undefined,
    titulosConsolidado: (d.titulosConsolidado as Record<string, string>) ?? undefined,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const projectToDb = (p: Project): any => ({
  id: p.id,
  name: p.name,
  data: {
    statusDateIndex: p.statusDateIndex,
    info: p.info,
    weeklyData: p.weeklyData,
    sCurveData: p.sCurveData,
    monthData: p.monthData,
    actions: p.actions,
    observations: p.observations,
    histogramData: p.histogramData,
    scheduleData: p.scheduleData,
    scheduleColunas: p.scheduleColunas || null,
    evidencias: p.evidencias || [],
    eapFinanceira: p.eapFinanceira || [],
    eapColunas: p.eapColunas || null,
    curvaSFinanceira: p.curvaSFinanceira || [],
    aiInsights: p.aiInsights || {},
    observacoesCards: p.observacoesCards || {},
    layoutRelatorio: p.layoutRelatorio || null,
    layoutConsolidado: p.layoutConsolidado || null,
    lastImports: p.lastImports || {},
    programacaoSemanal: p.programacaoSemanal || [],
    desvioAnalise: p.desvioAnalise || null,
    riscoConsolidado: p.riscoConsolidado || null,
    notaProblemas: p.notaProblemas || null,
    motivosDesvio: p.motivosDesvio || null,
    titulosConsolidado: p.titulosConsolidado || null,
  },
});

const updateSelectedProject = (projects: Project[], selectedId: string, updater: (p: Project) => Partial<Project>) => {
  return projects.map(p => p.id === selectedId ? { ...p, ...updater(p) } : p);
};

// Debounce helper for saving to DB
const saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const debouncedSave = (project: Project, delay = 800) => {
  if (saveTimers[project.id]) clearTimeout(saveTimers[project.id]);
  saveTimers[project.id] = setTimeout(async () => {
    await supabase
      .from('projects')
      .upsert([projectToDb(project)], { onConflict: 'id' });
  }, delay);
};

interface ProjectStoreState {
  projects: Project[];
  selectedProjectId: string;
  /** Papel restrito (visualizador/cliente): a tela avisa que a lista foi recortada. */
  acessoRestrito: boolean;
  loading: boolean;
  loadProjects: () => Promise<void>;
  selectProject: (id: string) => void;
  addProject: (name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setInfo: (info: Partial<ProjectInfo>) => void;
  /** Edita as informacoes de uma obra pelo id, sem trocar a selecao. */
  setInfoDoProjeto: (projectId: string, info: Partial<ProjectInfo>) => void;
  setStatusDateIndex: (index: number) => void;
  setWeeklyData: (data: WeekData[]) => void;
  setSCurveData: (data: SCurvePoint[]) => void;
  setMonthData: (data: MonthWeekData[]) => void;
  setDesvioAnalise: (data: DesvioAnalise) => void;
  addWeek: () => void;
  removeWeek: (index: number) => void;
  addSCurvePoint: () => void;
  removeSCurvePoint: (index: number) => void;
  setActions: (actions: ActionItem[]) => void;
  addAction: () => void;
  removeAction: (index: number) => void;
  setObservations: (obs: Observation[]) => void;
  addObservation: () => void;
  removeObservation: (index: number) => void;
  setHistogramData: (data: HistogramPoint[]) => void;
  addHistogramPoint: () => void;
  removeHistogramPoint: (index: number) => void;
  setScheduleData: (data: ScheduleRow[]) => void;
  /** Grava cronograma e as colunas importadas juntos. */
  setCronograma: (linhas: ScheduleRow[], colunas: ColunaCronograma[]) => void;
  /** Registra a foto ja enviada ao Storage. */
  addEvidencia: (evidencia: Evidencia) => void;
  /** EAP financeira — so admin, gestor e planejador enxergam. */
  setEapFinanceira: (itens: ItemEapFinanceira[], colunas?: ColunaEap[]) => void;
  removeEvidencia: (id: string) => void;
  setLegendaEvidencia: (id: string, legenda: string) => void;
  addScheduleRow: () => void;
  removeScheduleRow: (index: number) => void;
  setCurvaSFinanceira: (data: CurvaSFinanceiraPoint[]) => void;
  setAiInsight: (chartType: string, insight: string) => void;
  /** Arrumação dos cards do relatório. `null` volta ao padrão. */
  setLayoutRelatorio: (layout: ItemLayoutRelatorio[] | null) => void;
  /** Arrumação dos blocos do consolidado — vale para todas as obras. */
  setLayoutConsolidado: (layout: ItemLayoutRelatorio[] | null) => void;
  /** Análise de risco do consolidado — grava a mesma em todas as obras do cliente. */
  setRiscoConsolidado: (idsDoCliente: string[], texto: string, porIa: boolean, autor?: string) => void;
  /** Motivos do desvio do mes anotados numa obra. */
  setMotivosDesvio: (projectId: string, motivos: MotivoDesvio[]) => void;
  /** Plano de ação de UMA obra pelo id, sem trocar a seleção. */
  setActionsDoProjeto: (projectId: string, actions: ActionItem[]) => void;
  /** Renomeia uma pergunta do consolidado — vale para todas as obras. */
  setTituloConsolidado: (chave: string, texto: string) => void;
  /** Anota num card do relatório, carimbando a data. */
  addObservacaoCard: (card: string, texto: string, autor?: string) => void;
  removeObservacaoCard: (card: string, id: string) => void;
  setLastImport: (section: keyof NonNullable<Project['lastImports']>, iso: string) => void;
  addProgramacaoSemanal: (projectId: string, data: ProgramacaoSemanal) => void;
  clearProgramacaoSemanal: (projectId: string) => void;
  /** Justificativa 6M de uma atividade da programação semanal (causas + texto). */
  setAtividadeJustificativa: (
    projectId: string,
    semana: number,
    atividadeIndex: number,
    patch: { causas6M?: Causa6M[]; planoAcao?: string },
  ) => void;
}

export const useProjectStore = create<ProjectStoreState>()((set, get) => ({
  projects: [seedProject],
  selectedProjectId: 'guaxe',
  loading: false,
  acessoRestrito: false,

  loadProjects: async () => {
    set({ loading: true });
    // 1. Tenta carregar do Supabase ('projects'). Se a tabela não existir no
    //    projeto atual, cai no localStorage.
    let projects: Project[] | null = null;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, data')
        .order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        projects = (data as Array<{ id: string; name: string; data: Record<string, unknown> }>).map(dbToProject);
      }
    } catch { /* tabela ausente → fallback */ }

    // 2. Fallback: localStorage
    if (!projects) {
      const ls = loadProjectsLS();
      if (ls && ls.length > 0) projects = ls;
    }

    // 3. Último recurso: projeto seed
    if (!projects || projects.length === 0) projects = [seedProject];

    // 4. Recorte por papel. O seed do passo 3 também passa por aqui: liberar
    //    um projeto de exemplo para quem não tem obra atribuída seria dar
    //    justamente o acesso que este recorte existe para negar.
    const { papel, atribuidas, falhou } = await lerAcessoDoUsuario();
    const visiveis = obrasVisiveis(projects, papel, atribuidas);
    // Papel restrito com consulta de atribuição quebrada fecha a porta: numa
    // regra de acesso, o erro tem que negar, não liberar.
    const finais = acessoRestrito(papel) && falhou ? [] : visiveis;

    const currentId = get().selectedProjectId;
    const validId = finais.find(p => p.id === currentId) ? currentId : (finais[0]?.id ?? '');
    set({
      projects: finais,
      selectedProjectId: validId,
      loading: false,
      acessoRestrito: acessoRestrito(papel),
    });
    // Só o que a pessoa pode ver vai para o localStorage — senão a obra
    // escondida ficaria no disco da máquina dela.
    saveProjectsLS(finais);
  },

  selectProject: (id) => set({ selectedProjectId: id }),

  addProject: async (name) => {
    const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    const newProject = createDefaultProject(id, name);
    await supabase.from('projects').insert([projectToDb(newProject)]);
    set((s) => ({
      projects: [...s.projects, newProject],
      selectedProjectId: id,
    }));
  },

  deleteProject: async (id) => {
    const s = get();
    if (s.projects.length <= 1) return;
    await supabase.from('projects').delete().eq('id', id);
    const filtered = s.projects.filter(p => p.id !== id);
    set({
      projects: filtered,
      selectedProjectId: s.selectedProjectId === id ? filtered[0].id : s.selectedProjectId,
    });
  },

  setInfo: (info) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      info: { ...p.info, ...info },
      // name is user-defined and immutable via import
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  /**
   * Edita as informações de UMA obra pelo id.
   *
   * O `setInfo` mexe na obra selecionada; o consolidado precisa corrigir a
   * linha de outra obra sem trocar a seleção e levar o relatório junto.
   */
  setInfoDoProjeto: (projectId, info) => set((s) => {
    const updated = s.projects.map((p) => (p.id === projectId
      ? { ...p, info: { ...p.info, ...info } }
      : p));
    const alvo = updated.find((p) => p.id === projectId);
    if (alvo) debouncedSave(alvo);
    return { projects: updated };
  }),

  setStatusDateIndex: (index) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, () => ({ statusDateIndex: index }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setWeeklyData: (data) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, () => ({ weeklyData: data }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setSCurveData: (data) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, () => ({ sCurveData: data }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setMonthData: (data) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, () => ({ monthData: data }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setDesvioAnalise: (data) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, () => ({ desvioAnalise: data }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  addWeek: () => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      weeklyData: [...p.weeklyData, { date: '', previsto: 0, real: 0 }],
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  removeWeek: (index) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      weeklyData: p.weeklyData.filter((_, i) => i !== index),
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  addSCurvePoint: () => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      sCurveData: [...p.sCurveData, { date: '', previsto: 0, real: 0, tendencia: 0 }],
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  removeSCurvePoint: (index) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      sCurveData: p.sCurveData.filter((_, i) => i !== index),
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setActions: (actions) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, () => ({ actions }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  addAction: () => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      actions: [...p.actions, { id: p.actions.length + 1, problema: '', causa: '', impacto: '', atividade: '', responsavel: '', prazo: '', necessidade: '', status: '' as ActionStatus }],
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  removeAction: (index) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      actions: p.actions.filter((_, i) => i !== index).map((a, i) => ({ ...a, id: i + 1 })),
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setObservations: (obs) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, () => ({ observations: obs }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  addObservation: () => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      observations: [...p.observations, { id: p.observations.length + 1, text: '' }],
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  removeObservation: (index) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      observations: p.observations.filter((_, i) => i !== index).map((o, i) => ({ ...o, id: i + 1 })),
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setHistogramData: (data) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, () => ({ histogramData: data }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  addHistogramPoint: () => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      histogramData: [...(p.histogramData || []), { date: '', semana: '', previsto: 0, real: 0 }],
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  removeHistogramPoint: (index) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      histogramData: (p.histogramData || []).filter((_, i) => i !== index),
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setEapFinanceira: (itens, colunas) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      eapFinanceira: itens,
      // Sem colunas novas, as antigas ficam: editar uma célula na tabela não
      // pode apagar o formato que veio da colagem.
      eapColunas: colunas ?? p.eapColunas,
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  addEvidencia: (evidencia) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      evidencias: [...(p.evidencias || []), evidencia],
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  removeEvidencia: (id) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      evidencias: (p.evidencias || []).filter((e) => e.id !== id),
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setLegendaEvidencia: (id, legenda) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      evidencias: (p.evidencias || []).map((e) => (e.id === id ? { ...e, legenda } : e)),
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setCronograma: (linhas, colunas) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, () => ({
      scheduleData: linhas,
      scheduleColunas: colunas,
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setScheduleData: (data) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, () => ({ scheduleData: data }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  addScheduleRow: () => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      scheduleData: [...(p.scheduleData || []), { id: '', tarefa: '', previsto: 0, trabalhoConcluido: 0, desvio: 0, inicio: '', termino: '', inicioBase: '', terminoBase: '' }],
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  removeScheduleRow: (index) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      scheduleData: (p.scheduleData || []).filter((_, i) => i !== index),
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setCurvaSFinanceira: (data) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, () => ({ curvaSFinanceira: data }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),



  setAiInsight: (chartType, insight) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      aiInsights: { ...(p.aiInsights || {}), [chartType]: insight },
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  /**
   * A arrumação do relatório vale para TODAS as obras.
   *
   * O One Page Report é um formato único da Megasteam: o SPCI, o FRIGO e o
   * GUAXE têm que abrir iguais, senão cada reunião começa com quem apresenta
   * procurando onde foi parar o card. Por isso o layout é gravado em todos os
   * projetos, e não só no que está aberto.
   */
  setLayoutConsolidado: (layout) => set((s) => {
    const updated = s.projects.map((p) => ({ ...p, layoutConsolidado: layout ?? undefined }));
    updated.forEach((p) => debouncedSave(p));
    return { projects: updated };
  }),

  setLayoutRelatorio: (layout) => set((s) => {
    const updated = s.projects.map((p) => ({ ...p, layoutRelatorio: layout ?? undefined }));
    updated.forEach((p) => debouncedSave(p));
    return { projects: updated };
  }),

  /**
   * Análise de risco do consolidado.
   *
   * Grava a MESMA análise em todas as obras do cliente — cliente não é tabela
   * no banco, é um campo de texto da obra, e sem isso a análise sumiria assim
   * que alguém trocasse a obra selecionada. A leitura pega a cópia mais
   * recente, então uma obra criada depois não apaga o que já estava escrito.
   */
  /**
   * Problemas anotados à mão numa obra.
   *
   * Existe porque nem toda obra importa a Programação Semanal, e a reunião tem
   * problema para registrar do mesmo jeito. Fica na obra, não no cliente.
   */
  /**
   * Renomeia uma pergunta do consolidado.
   *
   * Vale para TODAS as obras, como o layout do relatório: o consolidado é a
   * mesma tela para qualquer cliente, e um título diferente por obra faria a
   * pergunta mudar ao trocar de cliente no seletor.
   */
  setTituloConsolidado: (chave, texto) => set((s) => {
    const updated = s.projects.map((p) => ({
      ...p,
      titulosConsolidado: { ...(p.titulosConsolidado ?? {}), [chave]: texto },
    }));
    updated.forEach((p) => debouncedSave(p));
    return { projects: updated };
  }),

  setActionsDoProjeto: (projectId, actions) => set((s) => {
    const updated = s.projects.map((p) => (p.id === projectId ? { ...p, actions } : p));
    const alvo = updated.find((p) => p.id === projectId);
    if (alvo) debouncedSave(alvo);
    return { projects: updated };
  }),

  setMotivosDesvio: (projectId, motivos) => set((s) => {
    const updated = s.projects.map((p) => (p.id === projectId
      // O campo único antigo sai junto: ele já foi absorvido pela lista na
      // leitura, e deixá-lo gravado o faria reaparecer duplicado.
      ? { ...p, motivosDesvio: motivos, notaProblemas: undefined }
      : p));
    const alvo = updated.find((p) => p.id === projectId);
    if (alvo) debouncedSave(alvo);
    return { projects: updated };
  }),

  setRiscoConsolidado: (idsDoCliente, texto, porIa, autor) => set((s) => {
    const alvo = new Set(idsDoCliente);
    const valor: RiscoConsolidado = {
      texto,
      atualizadoEm: new Date().toISOString(),
      autor,
      porIa,
    };
    const updated = s.projects.map((p) =>
      (alvo.has(p.id) ? { ...p, riscoConsolidado: valor } : p));
    updated.filter((p) => alvo.has(p.id)).forEach((p) => debouncedSave(p));
    return { projects: updated };
  }),

  addObservacaoCard: (card, texto, autor) => set((s) => {
    const limpo = texto.trim();
    if (!limpo) return {};
    const nova: ObservacaoCard = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      texto: limpo,
      data: new Date().toISOString(),
      autor,
    };
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      observacoesCards: {
        ...(p.observacoesCards || {}),
        [card]: [...((p.observacoesCards || {})[card] || []), nova],
      },
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  removeObservacaoCard: (card, id) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      observacoesCards: {
        ...(p.observacoesCards || {}),
        [card]: ((p.observacoesCards || {})[card] || []).filter((o) => o.id !== id),
      },
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setLastImport: (section, iso) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      lastImports: { ...(p.lastImports || {}), [section]: iso },
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  clearProgramacaoSemanal: (projectId) => set((s) => {
    const updated = s.projects.map((p) =>
      p.id !== projectId ? p : { ...p, programacaoSemanal: [] }
    );
    const proj = updated.find(p => p.id === projectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  setAtividadeJustificativa: (projectId, semana, atividadeIndex, patch) => set((s) => {
    const updated = s.projects.map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        programacaoSemanal: (p.programacaoSemanal ?? []).map((ps) =>
          ps.semana !== semana
            ? ps
            : {
                ...ps,
                atividades: ps.atividades.map((a, i) =>
                  i === atividadeIndex ? { ...a, ...patch } : a
                ),
              }
        ),
      };
    });
    const proj = updated.find(p => p.id === projectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

  addProgramacaoSemanal: (projectId, data) => set((s) => {
    const updated = s.projects.map((p) => {
      if (p.id !== projectId) return p;
      const existing = p.programacaoSemanal ?? [];
      const idx = existing.findIndex((ps) => ps.semana === data.semana);
      const next = idx >= 0
        ? existing.map((ps, i) => (i === idx ? data : ps))
        : [...existing, data];
      return { ...p, programacaoSemanal: next };
    });
    const proj = updated.find(p => p.id === projectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),

}));

// Espelha os projetos no localStorage a cada mudança → backup/persistência
// resiliente do OPR mesmo sem a tabela 'projects' no Supabase atual.
useProjectStore.subscribe((state) => saveProjectsLS(state.projects));

export const useCurrentProject = () => {
  const projects = useProjectStore(s => s.projects);
  const selectedProjectId = useProjectStore(s => s.selectedProjectId);
  // Lista vazia é caso real desde que a visão passou a ser recortada por
  // atribuição: sem este fallback, cada card quebraria ao ler o projeto nulo.
  const project = projects.find(p => p.id === selectedProjectId)
    || projects[0]
    || createDefaultProject('', '');
  return {
    ...project,
    histogramData: project.histogramData || [{ date: '', semana: '', previsto: 0, real: 0 }],
    scheduleData: project.scheduleData || [{ id: '', tarefa: '', previsto: 0, trabalhoConcluido: 0, desvio: 0, inicio: '', termino: '', inicioBase: '', terminoBase: '' }],
  };
};
