/**
 * Splash / zone boot / hero idle.
 * Splash timing mirrors the optimized splash UI mock (island → stroke → arrow → brand).
 */

export const APP_SPLASH = {
  /** Haptic when arrow locks (~620ms in mock). */
  hapticMs: 620,
  /** Invite deep-link — hold + clean fade, no SVG choreography. */
  shortMs: 560,
  /**
   * Full beat: CSS assembly ~1.1s + short hold, then accelerated exit.
   * dismissAt = finishMs − exitMs ≈ 1450 (mock minBrandTime).
   */
  finishMs: 1690,
  /** Accelerated veil (mock curve-exit) — don’t make the user wait. */
  exitMs: 240,
  shortExitMs: 180,
  reducedMs: 300,
  reducedExitMs: 150,
  /** Splash + Ignite shared seat (mock uses ~148–220; we keep denser UI scale). */
  markPx: 128,
  storageKey: 'tazia.splashSeen',
  /**
   * Ignite copy after veil is mostly clear.
   * dismissAt 1450 + ~70% of exit.
   */
  copyHandoffMs: 1620,
} as const;

/**
 * Cold-start / empty-hero entrance (“Se enciende”) — ritual mirror of IGNITE.
 * No confetti, no canvas. CTAs stay interactive from first paint.
 */
export const ZONE_BOOT = {
  sparkMs: 70,
  glowMs: 180,
  /** Gives CTA entrance 240ms to settle cleanly inside finishMs (520ms). */
  ctaAtMs: 280,
  finishMs: 520,
  /** Revisit / post-burn mini-boot — keep in sync with CSS --dur-ignite-ring. */
  revisitMs: 320,
  reducedMs: 140,
  storageKey: 'tazia.bootSeen',
  /** Shared brand mark: hero ↔ TopBar. */
  layoutId: 'tazia-mark',
} as const;

/**
 * Hero landing idle presence — decorative only (transform/opacity).
 * Pause when tab hidden, prefers-reduced-motion, or coarse pointer (parallax).
 * Mirror --dur-hero-* in CSS.
 */
export const HERO_IDLE = {
  /** Mark halo breath cycle (offset from sheenMs to avoid mechanical sync). */
  breathMs: 6800,
  /** Primary CTA idle sheen cycle. */
  sheenMs: 8600,
  /** Wait after last interaction before a single CTA nudge. */
  nudgeAfterMs: 10000,
  /** Crisp nudge length (not sluggish). */
  nudgeMs: 520,
  /** Silence after a nudge before the idle timer may fire again. */
  nudgeCooldownMs: 22000,
  /** Max parallax offset (px) for mark follow (fine-pointer devices only). */
  parallaxPx: 3.5,
} as const;
