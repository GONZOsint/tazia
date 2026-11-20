/**
 * Burn / ash / extinguish / ignite timelines (ms).
 *
 * Pixel front tNorm hits 1 at ~85% of finishMs (`BURN_FRONT_DURATION_RATIO` in
 * `fire/burnFrame.ts`); remaining time is particle linger.
 * CSS `--dur-burn` (900ms) is card collapse only — not `BURN.finishMs` (2200).
 *
 * Semantics (pixel overlays currently off — FireBurnButton + QR fire only):
 *   - BURN → session “apagar llama” timings (TopBar WebGL extinguish)
 *   - ZONE_ASH / EXTINGUISH / TALK_EXTINGUISH → kept for future RegionAsh revive
 *   - IGNITE → zone join light-on
 */

export const BURN = {
  ignitionMs: 720,
  peakAtMs: 520,
  collapseAtMs: 1100,
  /** Pixel extinguish front + particle linger (~reference 2.3s). */
  finishMs: 2200,
  reducedFrontMs: 100,
  reducedCollapseMs: 180,
  layoutId: 'burn-flame',
  /** Shared layoutId spring: TopBar flame → BurnFireOverlay (shrink / die). */
  layoutSpring: {
    type: 'spring' as const,
    visualDuration: 0.52,
    bounce: 0.03,
  },
} as const;

/**
 * Region teardown base timings (RegionAshOverlay).
 * Prefer ZONE_ASH (burn) or EXTINGUISH / TALK_EXTINGUISH (douse).
 */
export const REGION_ASH = {
  /** Alias of finishMs — safety timers / CSS var mirror. */
  durationMs: BURN.finishMs,
  collapseAtMs: BURN.collapseAtMs,
  /** Pixel fire front + particle linger (mirrors BURN.finishMs). */
  finishMs: BURN.finishMs,
  reducedMs: 180,
} as const;

/**
 * Zone burn — leave/delete zone locally (RegionAshOverlay mode=burn).
 * Hot incineration front; same duration as REGION_ASH.
 */
export const ZONE_ASH = REGION_ASH;

/**
 * Extinguish — hoguera / cool-down (smoke-heavy, cooler front).
 * Slightly shorter linger than full burn so “apagar” reads faster than “quemar”.
 */
export const EXTINGUISH = {
  durationMs: 1900,
  collapseAtMs: 980,
  finishMs: 1900,
  reducedMs: 160,
} as const;

/** Hoguera (thread) extinguish after unanimous vote. */
export const TALK_EXTINGUISH = EXTINGUISH;

/** @deprecated Prefer TALK_EXTINGUISH — alias kept for existing talk imports. */
export const TALK_ASH = TALK_EXTINGUISH;

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
