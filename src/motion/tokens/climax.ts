/**
 * Burn / ignite timelines (ms).
 *
 * Fire that burns UI is WebGL only:
 *   - Session enter → `igniteBurn` (pill+curl screen burn)
 *   - Session leave → FireBurnButton WebGL extinguish + BURN.ignitionMs
 *   - QR secret → `qrFire` WebGL ring
 */

export const BURN = {
  /** TopBar extinguish beat before session teardown/reload. */
  ignitionMs: 720,
} as const;

/**
 * Zone ignite (inverse of burn) — CSS/useAnimate glow, no canvas.
 * spark → ring → card glow → settle.
 */
export const IGNITE = {
  sparkMs: 80,
  glowMs: 280,
  finishMs: 420,
  reducedMs: 140,
  /** Shared spark morph: CTA submit → new zone card. */
  layoutId: 'ignite-ember',
} as const;
