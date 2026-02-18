import { create } from 'zustand';

interface ThemeStore {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const getInitialTheme = (): 'light' | 'dark' => {
  try {
    const stored = localStorage.getItem('megasteam-theme');
    return stored === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const useThemeStore = create<ThemeStore>(() => ({
  theme: getInitialTheme(),
  toggleTheme: () =>
    useThemeStore.setState((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', next === 'dark');
      try { localStorage.setItem('megasteam-theme', next); } catch {}
      return { theme: next };
    }),
}));

export const initTheme = () => {
  const theme = getInitialTheme();
  document.documentElement.classList.toggle('dark', theme === 'dark');
};
