import { create } from 'zustand';

/**
 * Modo de exportação — ligado apenas enquanto o PDF é capturado.
 *
 * Existe porque o html2canvas não desenha campos de formulário de forma
 * confiável: o valor de um `<input>`/`<textarea>` sai com a metade de baixo
 * cortada e o texto de um `<select>` simplesmente não aparece. Os cards que
 * editam dados precisam, então, trocar os campos por texto estático durante a
 * captura — e é este sinal que avisa.
 */
interface ExportModeState {
  exportando: boolean;
  setExportando: (on: boolean) => void;
}

export const useExportMode = create<ExportModeState>((set) => ({
  exportando: false,
  setExportando: (on) => set({ exportando: on }),
}));
