import { useCallback, useEffect, useState } from 'react';

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
 */
export function useSessionFlame(opts?: { autoIgnite?: boolean }) {
  const [lit, setLit] = useState(() => readLit() || Boolean(opts?.autoIgnite));

  useEffect(() => {
    if (opts?.autoIgnite && !readLit()) {
      writeLit(true);
      setLit(true);
    }
  }, [opts?.autoIgnite]);

  const ignite = useCallback(() => {
    writeLit(true);
    setLit(true);
  }, []);

  return { lit, ignite };
}
