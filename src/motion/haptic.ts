/**
 * Best-effort device vibration for ritual moments.
 * No-ops when unsupported / denied; never throws.
 */
export function haptic(pattern: number | number[] = 10): void {
  try {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

/** Short confirm (send OK, forge, mesh). */
export const HAPTIC_TAP = 8;
/** Stronger ritual (burn start, verify match). */
export const HAPTIC_RITUAL = 14;
