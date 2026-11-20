export const DUR = {
  tap: 0.1,
  micro: 0.14,
  tab: 0.16,
  medium: 0.2,
  switch: 0.22,
  modal: 0.22,
  plane: 0.26,
  /** CSS ornamentation — sheen hover sweep. */
  sheen: 0.3,
  flash: 0.28,
  /** Rare ornament (zone-join / QR ring) — keep ≤ 0.4s. */
  pulse: 0.36,
  ring: 0.36,
  /** Peer materialize / mesh birth settle. */
  birth: 0.28,
  /** QR success / passphrase douse. */
  ritual: 0.22,
} as const;

export const EASE = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  /** Accelerate out — pair with enter easeOut for AnimatePresence wait. */
  easeIn: [0.4, 0, 1, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
  inOut: [0.76, 0, 0.24, 1] as const,
  spring: { type: 'spring' as const, stiffness: 420, damping: 32 },
  /**
   * Chat bubble land-in — high stiffness + damping settles under ~300ms
   * with almost no bounce (frequent UI; save overshoot for rare moments).
   */
  bubbleSpring: { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.7 },
  /** Rare ritual settle — short overshoot (seal, trust, forge). */
  ritualSpring: {
    type: 'spring' as const,
    visualDuration: 0.28,
    bounce: 0.18,
  },
  /** Plane launch settle after anticipate. */
  planeSpring: {
    type: 'spring' as const,
    visualDuration: 0.22,
    bounce: 0.12,
  },
};
