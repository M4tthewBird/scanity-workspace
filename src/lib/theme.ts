import { useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'scanity-theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Bez úložiště volba platí jen do zavření stránky.
    }
    setTheme(next);
  };

  return { theme, toggle };
}
