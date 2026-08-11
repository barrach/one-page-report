import { create } from 'zustand';

/**
 * Modo TV — exibição em painel/TV, sem interação.
 *
 * Fica num store global porque os cards precisam saber que estão numa TV para
 * esconder o que é interativo (botões de IA) e para deixar o gráfico preencher a
 * tela, em vez de respeitar a altura mínima usada no relatório normal.
 */
interface TvModeState {
  tvMode: boolean;
  setTvMode: (on: boolean) => void;
}

export const useTvMode = create<TvModeState>((set) => ({
  tvMode: false,
  setTvMode: (on) => set({ tvMode: on }),
}));
