import { create } from 'zustand';

interface DarkModeState {
  isDark: boolean;
  toggleDarkMode: () => void;
}

export const useDarkModeStore = create<DarkModeState>((set) => ({
  isDark: (() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) {
        return saved === 'true';
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  })(),
  toggleDarkMode: () => set((state) => {
    const newIsDark = !state.isDark;
    localStorage.setItem('darkMode', String(newIsDark));
    const root = window.document.documentElement;
    if (newIsDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    return { isDark: newIsDark };
  }),
}));

// Initialize the class on load
if (typeof window !== 'undefined') {
  const isDark = useDarkModeStore.getState().isDark;
  const root = window.document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}
