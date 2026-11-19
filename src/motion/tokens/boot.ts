/**
 * Splash / zone boot / hero idle.
 */

export const APP_SPLASH = {
  /** Align with wordmark settle so the tap lands as the mark “locks”. */
  hapticMs: 720,
  /** Invite deep-link — hold + fade, no part stagger. */
  shortMs: 780,
  finishMs: 1680,
  exitMs: 360,
  /** Must stay ≥ exitMs so reduced-motion still gets a clean fade. */
  reducedMs: 400,
  markPx: 128,
  storageKey: 'tazia.splashSeen',
  /** Stage veil — opacity tween (fast-in / slow-out entrance curve). */
  stageOpacityDur: 0.36,
  /** Cream outline strokes (tween). */
  partTweenDur: 0.42,
  /** Wordmark rise after the mark assembles. */
  wordmarkDur: 0.4,
  /**
   * Island / chevron — duration-based spring so settle lines up with tweens.
   * @see https://motion.dev/docs/react-transitions#visualduration
   */
  partSpring: {
    type: 'spring' as const,
    visualDuration: 0.42,
    bounce: 0.16,
  },
  /** Stage scale uses a slightly longer settle than parts. */
  stageSpring: {
    type: 'spring' as const,
    visualDuration: 0.48,
    bounce: 0.14,
  },
  /**
   * Assembly order (paint order): outlines → island → arrow → wordmark.
   * Gaps sit in the 0.08–0.2s stagger band so the eye reads sequence, not lag.
   */
  delay: {
    outlineA: 0.08,
    outlineB: 0.18,
    island: 0.34,
    arrow: 0.54,
    wordmark: 0.72,
  },
} as const;

/**
 * Cold-start / empty-hero entrance (“Se enciende”) — ritual mirror of IGNITE.
 * No confetti, no canvas. CTAs stay interactive from first paint.
 */
export const ZONE_BOOT = {
  sparkMs: 80,
  glowMs: 200,
  ctaAtMs: 360,
  finishMs: 520,
  /** Revisit / post-burn mini-boot — must cover ignite-ring-expand (--dur-ignite-ring). */
  revisitMs: 320,
  reducedMs: 140,
  storageKey: 'tazia.bootSeen',
  /** Shared brand mark: hero ↔ TopBar. */
  layoutId: 'tazia-mark',
} as const;

/**
 * Hero landing idle presence — decorative only (transform/opacity).
 * Pause when tab hidden or prefers-reduced-motion. Mirror --dur-hero-* in CSS.
 */
export const HERO_IDLE = {
  /** Mark halo breath cycle. */
  breathMs: 7200,
  /** Primary CTA idle sheen cycle. */
  sheenMs: 7200,
  /** Wait after last interaction before a single CTA nudge. */
  nudgeAfterMs: 10000,
  /** Nudge animation length. */
  nudgeMs: 680,
  /** Silence after a nudge before the idle timer may fire again. */
  nudgeCooldownMs: 22000,
  /** Max parallax offset (px) for mark follow. */
  parallaxPx: 3.5,
} as const;
