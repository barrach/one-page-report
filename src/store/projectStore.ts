import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
}

export interface MonthWeekData {
  label: string;
  previsto: number;
  real: number;
}

export interface ActionItem {
  id: number;
  problema: string;
  causa: string;
  solucao: string;
}

export interface Observation {
  id: number;
  text: string;
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
}

const createDefaultProject = (id: string, name: string): Project => ({
  id,
  name,
  statusDateIndex: 0,
  info: {
    projeto: name,
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
    { id: 1, problema: '', causa: '', solucao: '' },
    { id: 2, problema: '', causa: '', solucao: '' },
  ],
  observations: [{ id: 1, text: '' }],
  histogramData: [{ date: '', semana: '', previsto: 0, real: 0 }],
  scheduleData: [{ id: '', tarefa: '', previsto: 0, trabalhoConcluido: 0, desvio: 0, inicio: '', termino: '', inicioBase: '', terminoBase: '' }],
});

const defaultProject: Project = {
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
    { id: 1, problema: '', causa: '', solucao: '' },
    { id: 2, problema: '', causa: '', solucao: '' },
    { id: 3, problema: '', causa: '', solucao: '' },
    { id: 4, problema: '', causa: '', solucao: '' },
  ],
  observations: [
    { id: 1, text: 'Fase 1 - com o término previsto para o dia 26/02' },
    { id: 2, text: '' },
    { id: 3, text: '' },
  ],
  histogramData: [{ date: '', semana: '', previsto: 0, real: 0 }],
  scheduleData: [{ id: '', tarefa: '', previsto: 0, trabalhoConcluido: 0, desvio: 0, inicio: '', termino: '', inicioBase: '', terminoBase: '' }],
};

const updateSelectedProject = (projects: Project[], selectedId: string, updater: (p: Project) => Partial<Project>) => {
  return projects.map(p => p.id === selectedId ? { ...p, ...updater(p) } : p);
};

interface ProjectStoreState {
  projects: Project[];
  selectedProjectId: string;
  selectProject: (id: string) => void;
  addProject: (name: string) => void;
  deleteProject: (id: string) => void;
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
}

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set) => ({
      projects: [defaultProject],
      selectedProjectId: 'guaxe',

      selectProject: (id) => set({ selectedProjectId: id }),

      addProject: (name) => {
        const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
        const newProject = createDefaultProject(id, name);
        set((s) => ({
          projects: [...s.projects, newProject],
          selectedProjectId: id,
        }));
      },

      deleteProject: (id) => set((s) => {
        if (s.projects.length <= 1) return s;
        const filtered = s.projects.filter(p => p.id !== id);
        return {
          projects: filtered,
          selectedProjectId: s.selectedProjectId === id ? filtered[0].id : s.selectedProjectId,
        };
      }),

      setInfo: (info) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
          info: { ...p.info, ...info },
          name: info.projeto || p.name,
        })),
      })),

      setStatusDateIndex: (index) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, () => ({ statusDateIndex: index })),
      })),

      setWeeklyData: (data) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, () => ({ weeklyData: data })),
      })),

      setSCurveData: (data) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, () => ({ sCurveData: data })),
      })),

      setMonthData: (data) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, () => ({ monthData: data })),
      })),

      addWeek: () => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
          weeklyData: [...p.weeklyData, { date: '', previsto: 0, real: 0 }],
        })),
      })),

      removeWeek: (index) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
          weeklyData: p.weeklyData.filter((_, i) => i !== index),
        })),
      })),

      addSCurvePoint: () => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
          sCurveData: [...p.sCurveData, { date: '', previsto: 0, real: 0, tendencia: 0 }],
        })),
      })),

      removeSCurvePoint: (index) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
          sCurveData: p.sCurveData.filter((_, i) => i !== index),
        })),
      })),

      setActions: (actions) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, () => ({ actions })),
      })),

      addAction: () => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
          actions: [...p.actions, { id: p.actions.length + 1, problema: '', causa: '', solucao: '' }],
        })),
      })),

      removeAction: (index) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
          actions: p.actions.filter((_, i) => i !== index).map((a, i) => ({ ...a, id: i + 1 })),
        })),
      })),

      setObservations: (obs) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, () => ({ observations: obs })),
      })),

      addObservation: () => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
          observations: [...p.observations, { id: p.observations.length + 1, text: '' }],
        })),
      })),

      removeObservation: (index) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
          observations: p.observations.filter((_, i) => i !== index).map((o, i) => ({ ...o, id: i + 1 })),
        })),
      })),

      setHistogramData: (data) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, () => ({ histogramData: data })),
      })),

      addHistogramPoint: () => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
          histogramData: [...(p.histogramData || []), { date: '', semana: '', previsto: 0, real: 0 }],
        })),
      })),

      removeHistogramPoint: (index) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
          histogramData: (p.histogramData || []).filter((_, i) => i !== index),
        })),
      })),

      setScheduleData: (data) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, () => ({ scheduleData: data })),
      })),

      addScheduleRow: () => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
          scheduleData: [...(p.scheduleData || []), { id: '', tarefa: '', previsto: 0, trabalhoConcluido: 0, desvio: 0, inicio: '', termino: '', inicioBase: '', terminoBase: '' }],
        })),
      })),

      removeScheduleRow: (index) => set((s) => ({
        projects: updateSelectedProject(s.projects, s.selectedProjectId, (p) => ({
          scheduleData: (p.scheduleData || []).filter((_, i) => i !== index),
        })),
      })),
    }),
    { name: 'project-store' }
  )
);

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
