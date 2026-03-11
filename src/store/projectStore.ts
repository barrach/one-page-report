import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

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
}

export interface WeekData {
  date: string;
  previsto: number;
  real: number;
}

export interface SCurvePoint {
  date: string;
  previsto: number;
  real: number;
  tendencia: number;
  replanejado?: number;
}

export interface SCurveSettings {
  showReplanejado: boolean;
}

export interface MonthWeekData {
  label: string;
  previsto: number;
  real: number;
}

export type ActionStatus = 'EM ANDAMENTO' | 'CONCLUÍDO' | 'CANCELADO' | 'ATRASADO' | '';

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

export interface HistogramPoint {
  date: string;
  semana: string;
  previsto: number;
  real: number;
}

export interface ScheduleRow {
  id: string;
  tarefa: string;
  previsto: number;
  trabalhoConcluido: number;
  desvio: number;
  inicio: string;
  termino: string;
  inicioBase: string;
  terminoBase: string;
  highlight?: boolean;
  bold?: boolean;
  criticalPath?: boolean;
}

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
  aiInsights?: Record<string, string>; // chartType -> insight text
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
    aiInsights: (d.aiInsights as Record<string, string>) ?? {},
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
    aiInsights: p.aiInsights || {},
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
  loading: boolean;
  loadProjects: () => Promise<void>;
  selectProject: (id: string) => void;
  addProject: (name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setInfo: (info: Partial<ProjectInfo>) => void;
  setStatusDateIndex: (index: number) => void;
  setWeeklyData: (data: WeekData[]) => void;
  setSCurveData: (data: SCurvePoint[]) => void;
  setMonthData: (data: MonthWeekData[]) => void;
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
  addScheduleRow: () => void;
  removeScheduleRow: (index: number) => void;
  setAiInsight: (chartType: string, insight: string) => void;
}

export const useProjectStore = create<ProjectStoreState>()((set, get) => ({
  projects: [seedProject],
  selectedProjectId: 'guaxe',
  loading: false,

  loadProjects: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, data')
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      // Seed the default project if DB is empty
      await supabase.from('projects').upsert([projectToDb(seedProject)], { onConflict: 'id' });
      set({ projects: [seedProject], selectedProjectId: 'guaxe', loading: false });
      return;
    }

    const projects = (data as Array<{ id: string; name: string; data: Record<string, unknown> }>).map(dbToProject);
    const currentId = get().selectedProjectId;
    const validId = projects.find(p => p.id === currentId) ? currentId : projects[0].id;
    set({ projects, selectedProjectId: validId, loading: false });
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
      name: info.projeto || p.name,
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
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

  setAiInsight: (chartType, insight) => set((s) => {
    const updated = updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
      aiInsights: { ...(p.aiInsights || {}), [chartType]: insight },
    }));
    const proj = updated.find(p => p.id === s.selectedProjectId)!;
    debouncedSave(proj);
    return { projects: updated };
  }),
}));

export const useCurrentProject = () => {
  const projects = useProjectStore(s => s.projects);
  const selectedProjectId = useProjectStore(s => s.selectedProjectId);
  const project = projects.find(p => p.id === selectedProjectId) || projects[0];
  return {
    ...project,
    histogramData: project.histogramData || [{ date: '', semana: '', previsto: 0, real: 0 }],
    scheduleData: project.scheduleData || [{ id: '', tarefa: '', previsto: 0, trabalhoConcluido: 0, desvio: 0, inicio: '', termino: '', inicioBase: '', terminoBase: '' }],
  };
};
