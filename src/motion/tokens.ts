/** Canonical motion tokens — Carbon/Fluent-inspired productive + expressive tiers. */

export const DUR = {
  tap: 0.12,
  micro: 0.15,
  tab: 0.18,
  medium: 0.22,
  switch: 0.26,
  burn: 0.38,
  modal: 0.2,
} as const;

export const EASE = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
  inOut: [0.76, 0, 0.24, 1] as const,
  spring: { type: 'spring' as const, stiffness: 380, damping: 30 },
};

export const TAP = { scale: 0.97 } as const;
export const TAP_TRANSITION = { duration: DUR.tap } as const;

export const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: DUR.tab, ease: EASE.outExpo },
};

export const zoneCardExit = {
  initial: { opacity: 1, height: 'auto', filter: 'blur(0px)' },
  exit: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    filter: 'blur(4px)',
    transition: { duration: DUR.burn, ease: EASE.inOut },
  },
};

export const contentSwitch = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: DUR.switch, ease: EASE.outExpo },
};
