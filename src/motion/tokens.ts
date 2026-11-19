/**
 * Canonical motion tokens — keep in sync with `--dur-*` in styles/index.css.
 *
 * Engine contract (one motor per gesture):
 *   - Frequent chrome taps / panel fades → Motion duration tweens (TAP, contentSwitch)
 *   - Send plane → Motion useAnimate only (no CSS .plane-launching)
 *   - Burn button heating → CSS (.burn-heat.is-heating)
 *   - Burn climax → canvas BurnFireOverlay + optional layoutId spark
 *   - Zone ignite / leave incinerate → CSS classes + IGNITE / BURN timings
 *   - App entrance → ZONE_BOOT (ritual; no confetti / no canvas)
 *   - Confetti / seal / mesh birth → Motion presets (ritual tier; confetti = create+verify only)
 *
 * Tiers (NN/g + Fluent hierarchy):
 *   frequent ≤150ms  |  panel ~200–220ms  |  ritual ≤400ms spring  |  climax BURN ~1s
 */

export const MOTION_TIER = {
  frequent: 'frequent',
  panel: 'panel',
  ritual: 'ritual',
  climax: 'climax',
} as const;

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
  burn: 0.48,
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

/**
 * Shared burn choreography — keep TopBar / overlay / CSS collapse in sync.
 *
 * Timeline (full motion):
 *   0ms     ignition front + seed burst
 *   peakAt  secondary peak burst (flames crest)
 *   collapse card incinerates while residual embers rise
 *   finish  teardown + session wipe
 */
export const BURN = {
  ignitionMs: 480,
  peakAtMs: 180,
  collapseAtMs: 360,
  finishMs: 960,
  reducedFrontMs: 80,
  reducedCollapseMs: 140,
  layoutId: 'burn-flame',
  /** Shared layoutId spring: TopBar flame → BurnFireOverlay. */
  layoutSpring: {
    type: 'spring' as const,
    visualDuration: 0.32,
    bounce: 0.18,
  },
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

/**
 * Cold-start / empty-hero entrance (“Se enciende”) — ritual mirror of IGNITE.
 * No confetti, no canvas. CTAs stay interactive from first paint.
 *
 * Timeline (full):
 *   0ms          cold glow opens
 *   sparkMs      mark flash + settle
 *   glowMs       ring / ember settle
 *   chainStartMs Frase → Tribu → Quemar chain
 *   ctaAtMs      CTA emphasis (already clickable)
 *   finishMs     rest pose
 */
export const ZONE_BOOT = {
  sparkMs: 80,
  glowMs: 200,
  chainStartMs: 280,
  chainStepMs: 80,
  ctaAtMs: 480,
  finishMs: 640,
  /** Revisit / post-burn mini-boot. */
  revisitMs: 200,
  reducedMs: 140,
  storageKey: 'tazia.bootSeen',
  /** Shared brand mark: hero ↔ TopBar. */
  layoutId: 'tazia-mark',
} as const;

/** Lime/ash confetti — max 400ms; only create-zone + verify OK. */
export const CONFETTI = {
  ms: 400,
  count: 14,
} as const;

/**
 * Emoji verify handshake — readable pace (Material / Apple: ritual > 300ms).
 * Sweep + collapse + tick hold before dismiss.
 */
export const VERIFY = {
  enterStagger: 0.09,
  enterDur: 0.34,
  pulseDur: 0.34,
  pulseStagger: 0.08,
  collapseDur: 0.4,
  collapseStagger: 0.07,
  tickSpring: { type: 'spring' as const, visualDuration: 0.42, bounce: 0.22 },
  /** Time after tick appears before closing / calling onVerify. */
  tickHoldMs: 780,
  reducedHoldMs: 200,
} as const;

/** Mesh birth one-shot (not idle radar). */
export const MESH_BIRTH = {
  waveMs: 360,
  dotStaggerMs: 40,
  reducedMs: 120,
} as const;

export const TAP = { scale: 0.97 } as const;
export const TAP_TRANSITION = { duration: DUR.tap } as const;

/**
 * Shared layoutId indicator for bottom / top nav.
 * Duration-based spring (Motion docs): tight bounce so the pill slides, not floats.
 * @see https://motion.dev/docs/react-layout-animations
 */
export const NAV_INDICATOR = {
  type: 'spring' as const,
  visualDuration: 0.22,
  bounce: 0.08,
} as const;

/** Icon-only press — slightly deeper than full-button TAP. */
export const NAV_TAP = { scale: 0.9 } as const;

/** Cold leave — opacity + scale; pair with AnimatePresence popLayout (no height CSS). */
export const zoneCardExit = {
  initial: { opacity: 1, scale: 1 },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: DUR.tab, ease: EASE.easeIn },
  },
};

/** Soft panel enter — keep opacity high to avoid blank-frame flicker. */
export const contentSwitch = {
  initial: { opacity: 0.92, y: 3 },
  animate: { opacity: 1, y: 0 },
  exit: {
    opacity: 0.92,
    y: -2,
    transition: { duration: DUR.micro, ease: EASE.easeIn },
  },
  transition: { duration: DUR.tab, ease: EASE.outExpo },
};

/** Alias for create/join form panels — same motor as contentSwitch. */
export const panelEnter = contentSwitch;

/** ZONE_BOOT mark settle (full choreography). */
export const zoneBootMark = {
  initial: { opacity: 0, y: 10, scale: 0.88 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: EASE.ritualSpring,
} as const;

/** ZONE_BOOT mark — revisit / reduced: short fade only. */
export const zoneBootMarkShort = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: DUR.switch, ease: EASE.outExpo },
} as const;

/** ZONE_BOOT copy / steps / CTAs — opacity + slight rise. */
export const zoneBootCopy = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.switch, ease: EASE.outExpo },
} as const;

/** ZONE_BOOT reduced-motion: fade only. */
export const zoneBootReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: DUR.micro, ease: EASE.outExpo },
} as const;

/**
 * Zone switch inside Plaza (apagón).
 * Opacity-first; no scale/blur — scale+blur flickers on Windows GPUs.
 */
export const enterPlaza = {
  initial: { opacity: 0.9, y: 4 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.tab, ease: EASE.outExpo },
  },
  exit: {
    opacity: 0.9,
    y: -2,
    transition: { duration: DUR.micro, ease: EASE.easeIn },
  },
};

/**
 * Shared short panel / disclosure open-close.
 * Exit shorter than enter (Material / NN/g).
 */
export const disclosure = {
  initial: { opacity: 0, height: 0 },
  animate: {
    opacity: 1,
    height: 'auto',
    transition: { duration: DUR.medium, ease: EASE.outExpo },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: DUR.tab, ease: EASE.easeIn },
  },
  transition: { duration: DUR.medium, ease: EASE.outExpo },
};

/** Modal backdrop fade. */
export const modalScrim = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: DUR.micro, ease: EASE.easeIn } },
  transition: { duration: DUR.micro, ease: EASE.outExpo },
};

/** Modal / sheet body — enter longer than exit. */
export const modalSheet = {
  initial: { opacity: 0, y: 12, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.98,
    transition: { duration: DUR.tab, ease: EASE.easeIn },
  },
  transition: { duration: DUR.modal, ease: EASE.outExpo },
};

/** Toast stack card. */
export const toastEnter = {
  initial: { opacity: 0, y: 10, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1, x: 0 },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.97,
    transition: { duration: DUR.micro, ease: EASE.easeIn },
  },
  transition: { duration: DUR.medium, ease: EASE.outExpo },
};

/**
 * List row land-in (presence peers, zone cards).
 * Use with AnimatePresence popLayout + initial={false}.
 */
export const listRowEnter = {
  initial: { opacity: 0, y: 8, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      opacity: { duration: DUR.micro, ease: EASE.outExpo },
      y: { duration: DUR.medium, ease: EASE.outExpo },
      scale: { duration: DUR.medium, ease: EASE.outExpo },
    },
  },
};

/** New zone forge — slightly more travel than listRowEnter (ritual). */
export const forgeEnter = {
  initial: { opacity: 0, y: 14, scale: 0.94 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      opacity: { duration: DUR.micro, ease: EASE.outExpo },
      y: EASE.ritualSpring,
      scale: EASE.ritualSpring,
    },
  },
};

/** Peer avatar materialize on join. */
export const peerMaterialize = {
  initial: { opacity: 0, scale: 0.82 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: EASE.ritualSpring,
  },
};

/** @deprecated Prefer listRowEnter — kept as alias for peer rows. */
export const peerRowEnter = listRowEnter;

export const peerRowExit = {
  opacity: 0,
  scale: 0.97,
  transition: { duration: DUR.tab, ease: EASE.easeIn },
};

/** Unread / status badge pop. */
export const badgePop = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1 },
  exit: {
    opacity: 0,
    scale: 0.6,
    transition: { duration: DUR.micro, ease: EASE.easeIn },
  },
  transition: { duration: DUR.micro, ease: EASE.outExpo },
};

/** Unread badge melt/ash exit (eco of burn) — opacity + scale only (no filter). */
export const badgeMelt = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1 },
  exit: {
    opacity: 0,
    scaleY: 0.35,
    scaleX: 0.85,
    transition: { duration: DUR.switch, ease: EASE.easeIn },
  },
  transition: { duration: DUR.micro, ease: EASE.outExpo },
};

/** Top-of-app notice banner (burn notice, etc.). */
export const bannerEnter = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: DUR.micro, ease: EASE.easeIn },
  },
  transition: { duration: DUR.medium, ease: EASE.outExpo },
};

/**
 * Icon / label swap inside mode="wait" AnimatePresence
 * (theme, copy, secret phrase, lang).
 */
export const iconSwap = {
  initial: { opacity: 0, scale: 0.85, y: 4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: {
    opacity: 0,
    scale: 0.85,
    y: -4,
    transition: { duration: DUR.micro, ease: EASE.easeIn },
  },
  transition: { duration: DUR.tab, ease: EASE.outExpo },
};

/**
 * Message / post land-in.
 * Opacity eases in faster than y/scale so text is readable before settle.
 * Pair with `bubbleOrigin(isSelf)` on DM bubbles; plaza posts use center.
 * Skip with `initial={false}` on first paint / history hydrate.
 */
export const bubbleEnter = {
  initial: { opacity: 0, y: 10, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: DUR.micro, ease: EASE.easeIn },
  },
  transition: {
    opacity: { duration: DUR.micro, ease: EASE.outExpo },
    y: EASE.bubbleSpring,
    scale: EASE.bubbleSpring,
  },
};

/** Reduced-motion: fade only — no travel / scale (NN/g + beUI). */
export const bubbleEnterReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: DUR.micro, ease: EASE.easeIn } },
  transition: { duration: DUR.micro, ease: EASE.outExpo },
};

/** Land after plane launch — delay so bubble follows send icon. */
export const bubbleEnterFromSend = {
  ...bubbleEnter,
  transition: {
    opacity: { duration: DUR.micro, ease: EASE.outExpo, delay: DUR.plane * 0.5 },
    y: { ...EASE.bubbleSpring, delay: DUR.plane * 0.4 },
    scale: { ...EASE.bubbleSpring, delay: DUR.plane * 0.4 },
  },
};

/** First message into an empty thread — slightly more ritual. */
export const firstContentEnter = {
  initial: { opacity: 0, y: 16, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: bubbleEnter.exit,
  transition: {
    opacity: { duration: DUR.tab, ease: EASE.outExpo },
    y: EASE.ritualSpring,
    scale: EASE.ritualSpring,
  },
};

export type BubbleEnterOpts = {
  fromSend?: boolean;
  firstContent?: boolean;
};

export function resolveBubbleEnter(
  reduceMotion: boolean | null | undefined,
  opts?: BubbleEnterOpts
) {
  if (reduceMotion) return bubbleEnterReduced;
  if (opts?.firstContent) return firstContentEnter;
  if (opts?.fromSend) return bubbleEnterFromSend;
  return bubbleEnter;
}

/** Grow from the bubble’s bottom corner on its own side (sent = right). */
export function bubbleOrigin(isSelf: boolean) {
  return { originX: isSelf ? 1 : 0, originY: 1 } as const;
}

/** Plaza posts are full-bleed — rise from bottom center. */
export const postOrigin = { originX: 0.5, originY: 1 } as const;

/** Sealed Susurro lock mark on the timestamp — settles in with the bubble. */
export const sealIcon = {
  initial: { opacity: 0, scale: 0.72 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { delay: 0.06, ...EASE.ritualSpring },
  },
};

/** Brief timestamp ember flash after seal — opacity only (no filter; Windows GPU). */
export const sealFlash = {
  initial: { opacity: 0.45 },
  animate: {
    opacity: 1,
    transition: { duration: DUR.medium, ease: EASE.outExpo },
  },
};

/** Side drawer / sheet panel (forum topics on mobile). */
export const drawerPanel = {
  initial: { x: '-100%' },
  animate: { x: 0 },
  exit: {
    x: '-100%',
    transition: { duration: DUR.tab, ease: EASE.easeIn },
  },
  transition: NAV_INDICATOR,
};

export const staggerChild = (index: number, step = 0.035) => ({
  transition: { delay: index * step, duration: DUR.switch, ease: EASE.outExpo },
});
