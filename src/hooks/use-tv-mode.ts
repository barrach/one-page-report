import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Modo TV — exibição em painel/TV, sem interação.
 *
 * Fica num store global porque os cards precisam saber que estão numa TV para
 * esconder o que é interativo (botões de IA) e para deixar o gráfico preencher a
 * tela, em vez de respeitar a altura mínima usada no relatório normal.
 *
 * O estado é PERSISTIDO de propósito: o modo TV só termina quando o usuário
 * clica em sair. Sem isso, qualquer remontagem da tela do relatório — refresh de
 * token do Supabase, atualização do service worker, recarregamento da página —
 * derrubava o painel sozinho, o que é inaceitável numa TV que fica ligada.
 */
interface TvModeState {
  tvMode: boolean;
  setTvMode: (on: boolean) => void;
}

export const useTvMode = create<TvModeState>()(
  persist(
    (set) => ({
      tvMode: false,
      setTvMode: (on) => set({ tvMode: on }),
    }),
    { name: 'opr-tv-mode' },
  ),
);
