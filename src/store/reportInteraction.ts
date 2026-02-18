import { create } from 'zustand';

interface ReportInteractionState {
  selectedDate: string | null;
  selectedMonthIndex: number | null;
  selectionSource: string | null;
  setSelectedDate: (date: string | null, source: string) => void;
  setSelectedMonthIndex: (index: number | null, source: string) => void;
  clearSelection: () => void;
}

export const useReportInteraction = create<ReportInteractionState>((set) => ({
  selectedDate: null,
  selectedMonthIndex: null,
  selectionSource: null,

  setSelectedDate: (date, source) =>
    set((s) => ({
      selectedDate: s.selectedDate === date ? null : date,
      selectedMonthIndex: null,
      selectionSource: s.selectedDate === date ? null : source,
    })),

  setSelectedMonthIndex: (index, source) =>
    set((s) => ({
      selectedMonthIndex: s.selectedMonthIndex === index ? null : index,
      selectedDate: null,
      selectionSource: s.selectedMonthIndex === index ? null : source,
    })),

  clearSelection: () =>
    set({ selectedDate: null, selectedMonthIndex: null, selectionSource: null }),
}));
