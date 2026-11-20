import { useCallback, useState } from 'react';

const SESSION_LIT_KEY = 'tazia-session-lit';

function readLit(): boolean {
  try {
    return sessionStorage.getItem(SESSION_LIT_KEY) === '1';
  } catch {
    return false;
  }
}

function writeLit(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(SESSION_LIT_KEY, '1');
    else sessionStorage.removeItem(SESSION_LIT_KEY);
  } catch {
    /* private mode / blocked storage */
  }
}

/**
 * App-level flame session (not zone membership).
 * Survives tab navigations; cleared by burnSession's sessionStorage.clear().
 *
 * `autoIgnite` is cold-load only (initial invite). Later hashchange invites
 * must not silently skip Encender llama.
 *
 * When returning from extinguish (`burnNotice`), ignore any stale lit flag so
 * the landing ritual / notice path can run.
 */
export function useSessionFlame(opts?: { autoIgnite?: boolean; burnNotice?: boolean }) {
  const [lit, setLit] = useState(() => {
    if (opts?.burnNotice) {
      writeLit(false);
      return false;
    }
    if (readLit()) return true;
    if (opts?.autoIgnite) {
      writeLit(true);
      return true;
    }
    return false;
  });

  const ignite = useCallback(() => {
    writeLit(true);
    setLit(true);
  }, []);

  return { lit, ignite };
}
