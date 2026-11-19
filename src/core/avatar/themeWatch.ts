export type FlameThemeMode = 'light' | 'dark';

type ThemeListener = (mode: FlameThemeMode) => void;

const listeners = new Set<ThemeListener>();
let observer: MutationObserver | null = null;

function readTheme(): FlameThemeMode {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function ensureObserver(): void {
  if (observer || typeof document === 'undefined') return;
  observer = new MutationObserver(() => {
    const mode = readTheme();
    for (const fn of listeners) fn(mode);
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}

/** One document theme observer shared by all flame avatars. */
export function subscribeFlameTheme(fn: ThemeListener): () => void {
  ensureObserver();
  listeners.add(fn);
  fn(readTheme());
  return () => {
    listeners.delete(fn);
  };
}

export { readTheme };
