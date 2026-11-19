/** Canonical motion tokens — keep in sync with `--dur-*` in styles/index.css. */

export const DUR = {
  tap: 0.1,
  micro: 0.14,
  tab: 0.16,
  medium: 0.2,
  switch: 0.22,
  burn: 0.36,
  modal: 0.22,
  plane: 0.26,
} as const;

export const EASE = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  /** Accelerate out — pair with enter easeOut for AnimatePresence wait. */
  easeIn: [0.4, 0, 1, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
  inOut: [0.76, 0, 0.24, 1] as const,
  spring: { type: 'spring' as const, stiffness: 420, damping: 32 },
  /** Soft overshoot for chat bubbles (Telegram-lite). */
  bubbleSpring: { type: 'spring' as const, stiffness: 440, damping: 30 },
};

/** Shared burn choreography — keep TopBar / overlay / CSS collapse in sync. */
export const BURN = {
  ignitionMs: 400,
  collapseAtMs: 200,
  finishMs: 620,
  reducedFrontMs: 80,
  reducedCollapseMs: 140,
} as const;

/** Zone ignite (inverse of burn) — CSS/useAnimate glow, no canvas. */
export const IGNITE = {
  glowMs: 240,
  finishMs: 360,
} as const;

/** Sealed whisper flash hold before fade (permanent mark stays on timestamp). */
export const SEAL_FLASH_MS = 1300;

export const TAP = { scale: 0.97 } as const;
export const TAP_TRANSITION = { duration: DUR.tap } as const;

/** Cold leave — opacity + scale; pair with AnimatePresence popLayout (no height CSS). */
export const zoneCardExit = {
  initial: { opacity: 1, scale: 1 },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: DUR.tab, ease: EASE.easeIn },
  },
};

export const contentSwitch = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: DUR.switch, ease: EASE.outExpo },
};

/**
 * Rooms → plaza / zone switch (apagón).
 * Opacity-first; light y/scale. No CSS filter blur — flickers on Windows GPUs.
 * AnimatePresence mode="wait": easeIn exit, easeOut enter.
 */
export const enterPlaza = {
  initial: { opacity: 0, y: 6, scale: 0.985 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DUR.switch, ease: EASE.outExpo },
  },
  exit: {
    opacity: 0,
    y: -3,
    scale: 0.99,
    transition: { duration: DUR.tab, ease: EASE.easeIn },
  },
};

/** Shared short panel / disclosure open-close. */
export const disclosure = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: DUR.medium, ease: EASE.outExpo },
};

/** Message / post land-in. */
export const bubbleEnter = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: EASE.bubbleSpring,
};

/** Tribe peer row enter/exit — use with AnimatePresence popLayout + layout. */
export const peerRowEnter = {
  initial: { opacity: 0, scale: 0.96 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: DUR.medium, ease: EASE.outExpo },
  },
};

export const peerRowExit = {
  opacity: 0,
  scale: 0.96,
  transition: { duration: DUR.tab, ease: EASE.easeIn },
};

/** Sealed Susurro lock icon flash. */
export const sealIcon = {
  initial: { opacity: 0, scale: 0.85 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: DUR.micro, ease: EASE.outExpo },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: DUR.tap, ease: EASE.easeIn },
  },
};

export const staggerChild = (index: number, step = 0.035) => ({
  transition: { delay: index * step, duration: DUR.switch, ease: EASE.outExpo },
});
