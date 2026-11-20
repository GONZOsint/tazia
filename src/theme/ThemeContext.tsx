import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'tazia-theme';
const THEME_COLOR: Record<ThemeMode, string> = {
  light: '#e4e1da',
  dark: '#0b0d09',
};

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function readSavedTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

function detectSystemTheme(): ThemeMode {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function detectTheme(): ThemeMode {
  return readSavedTheme() ?? detectSystemTheme();
}

function applyThemeClass(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
  root.dataset.theme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[mode]);
}

export interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(detectTheme);
  const themeRef = useRef<ThemeMode>(theme);

  useIsomorphicLayoutEffect(() => {
    themeRef.current = theme;
    applyThemeClass(theme);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    themeRef.current = mode;
    applyThemeClass(mode);
    setThemeState(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(themeRef.current === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next =
        e.newValue === 'light' || e.newValue === 'dark' ? e.newValue : detectSystemTheme();
      themeRef.current = next;
      applyThemeClass(next);
      setThemeState(next);
    };

    window.addEventListener('storage', handleStorage);

    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;

    const handleMedia = (e: MediaQueryListEvent) => {
      if (readSavedTheme() !== null) return;
      const next: ThemeMode = e.matches ? 'dark' : 'light';
      themeRef.current = next;
      applyThemeClass(next);
      setThemeState(next);
    };

    mql?.addEventListener?.('change', handleMedia);

    return () => {
      window.removeEventListener('storage', handleStorage);
      mql?.removeEventListener?.('change', handleMedia);
    };
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}