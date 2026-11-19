/** Canonical motion tokens — keep in sync with `--dur-*` in styles/index.css. */

export const DUR = {
  tap: 0.12,
  micro: 0.15,
  tab: 0.18,
  medium: 0.22,
  switch: 0.24,
  burn: 0.38,
  modal: 0.2,
  plane: 0.36,
} as const;

export const EASE = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
  inOut: [0.76, 0, 0.24, 1] as const,
  spring: { type: 'spring' as const, stiffness: 380, damping: 30 },
  /** Soft overshoot for chat bubbles (Telegram-lite). */
  bubbleSpring: { type: 'spring' as const, stiffness: 420, damping: 28 },
};

/** Shared burn choreography — keep TopBar / overlay / CSS collapse in sync. */
export const BURN = {
  ignitionMs: 520,
  collapseAtMs: 220,
  finishMs: 720,
  reducedFrontMs: 80,
  reducedCollapseMs: 160,
} as const;

export const TAP = { scale: 0.97 } as const;
export const TAP_TRANSITION = { duration: DUR.tap } as const;

export const zoneCardExit = {
  initial: { opacity: 1, height: 'auto' },
  exit: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    transition: { duration: DUR.burn, ease: EASE.inOut },
  },
};

export const contentSwitch = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: DUR.switch, ease: EASE.outExpo },
};

/**
 * Rooms → plaza / zone switch.
 * No CSS filter blur — blur on large trees flickers on Windows GPUs.
 */
export const enterPlaza = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: DUR.switch, ease: EASE.outExpo },
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

export const staggerChild = (index: number, step = 0.04) => ({
  transition: { delay: index * step, duration: DUR.switch, ease: EASE.outExpo },
});
