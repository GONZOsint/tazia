/**
 * Best-effort device vibration for ritual moments.
 * No-ops when unsupported, backgrounded, pre-gesture, or denied; never throws.
 */
export function haptic(pattern: number | readonly number[] = 10): void {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } })
      .userActivation;
    if (ua && ua.hasBeenActive === false) return;

    if (typeof pattern === 'number') {
      if (!Number.isFinite(pattern) || pattern < 0) return;
      navigator.vibrate(pattern);
      return;
    }

    if (pattern.length === 0) return;
    navigator.vibrate([...pattern]);
  } catch {
    /* ignore */
  }
}

/** Short confirm (send OK, forge, mesh). */
export const HAPTIC_TAP = 8;
/** Stronger ritual (burn start, verify match). */
export const HAPTIC_RITUAL = 14;