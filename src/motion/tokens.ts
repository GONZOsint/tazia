/**
 * Canonical motion tokens — keep in sync with `--dur-*` in styles/index.css.
 *
 * Engine contract (one motor per gesture):
 *   - Frequent chrome taps / panel fades → Motion duration tweens (TAP, contentSwitch)
 *   - Send plane → Motion useAnimate only (no CSS .plane-launching)
 *   - Burn button heating → CSS (.burn-heat.is-heating / flame-flicker-hover)
 *   - Burn climax → canvas BurnFireOverlay (density field + blur) + layoutId spark
 *   - Zone ignite → CSS + IGNITE; zone leave → Motion zoneCardExit + zoneListLayout (not incinerated-collapse)
 *   - Talk delete ash → CSS `.plaza-talk-incinerate` + TALK_ASH / --dur-talk-ash
 *   - Hero burn phrase → CSS goo plume (#tazia-fire-plume) behind sharp type
 *   - Hero idle presence → CSS breath/sheen + JS nudge/parallax (HERO_IDLE; paused when hidden / reduced)
 *   - App entrance → APP_SPLASH then ZONE_BOOT (ritual; no confetti / no canvas)
 *   - Confetti / seal / mesh birth → Motion presets (ritual tier; confetti = create+verify only)
 *
 * Tiers (NN/g + Fluent hierarchy):
 *   frequent ≤150ms  |  panel ~200–220ms  |  ritual ≤400ms spring  |  climax BURN ~1.5s
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
  /**
   * Climax-short Motion tier (~0.68s) — conceptual band between ritual and
   * full BURN canvas. CSS card collapse uses `--dur-burn` (900ms), not this.
   */
  burn: 0.68,
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
 *   0ms     ignition front + seed burst (anticipation)
 *   peakAt  mid-ignition crest (bar still filling to ignitionMs)
 *   collapse card incinerates while residual embers rise
 *   finish  teardown + session wipe
 */
export const BURN = {
  ignitionMs: 720,
  peakAtMs: 520,
  collapseAtMs: 1100,
  /** Pixel fire front + particle linger (~reference 2.3s). */
  finishMs: 2200,
  reducedFrontMs: 100,
  reducedCollapseMs: 180,
  layoutId: 'burn-flame',
  /** Shared layoutId spring: TopBar flame → BurnFireOverlay. */
  layoutSpring: {
    type: 'spring' as const,
    visualDuration: 0.52,
    bounce: 0.03,
  },
} as const;

/**
 * Plaza talk ash — unanimous delete exit for every peer.
 * CSS `.plaza-talk-incinerate` / `.plaza-topic-incinerate` + TalkAshOverlay canvas fire.
 */
export const TALK_ASH = {
  durationMs: 1100,
  reducedMs: 180,
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
 * Full-screen cold splash (Telegram / Duolingo beat) — once per session.
 * Marks ZONE_BOOT.storageKey so the hero does not re-ritualize after.
 *
 * Timing (Motion docs + UX):
 *   - Entrances use outExpo / duration-based springs (`visualDuration`) so
 *     tweens and springs share one clock (motion.dev/docs/react-transitions).
 *   - Part stagger ~80–120ms — cascade without watching a queue
 *     (staggerChildren sweet spot; Systra / Magic UI).
 *   - Tween parts ~0.4–0.5s; springs visualDuration ~0.42s (pleasant UI band).
 *   - Total finish under ~2s brand beat — splash should not invent long waits
 *     (Material / UXPin: prefer recognition over forced admire-time).
 *
 * Timeline (full):
 *   0ms          black field + stage opacity/scale
 *   delay.outlineA / outlineB  cream strokes
 *   delay.island               lime island spring
 *   delay.arrow                chevron spring
 *   delay.wordmark + hapticMs  name + light tap
 *   finish−exit                fade veil (easeIn, shorter than enter)
 *   finishMs                   unmount
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
 *
 * Timeline (full):
 *   0ms       cold glow opens
 *   sparkMs   mark flash + settle
 *   glowMs    ring / ember settle
 *   ctaAtMs   CTA emphasis (already clickable)
 *   finishMs  rest pose
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

/** Lime/ash confetti — max 400ms; only create-zone + verify OK. */
export const CONFETTI = {
  ms: 400,
  count: 20,
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

/**
 * Cold leave (zone card) — Motion-only. Do NOT pair with `.incinerated-collapse`
 * (that class is for session burn via BurnFireOverlay; its opacity/filter/transform
 * fight Motion inline styles, and max-height:80rem→0 barely collapses in time).
 * No filter/blur — flickers on Windows GPUs (same rule as enterPlaza).
 *
 * Choreography: optimistic unmount → AnimatePresence popLayout runs `exit` while
 * siblings spring into place via `zoneListLayout` (overlap, not wait-then-jump).
 */
export const zoneCardExit = {
  initial: { opacity: 1, scale: 1, y: 0 },
  /** @deprecated Prefer `exit` — kept for any leftover incinerate callers. */
  incinerate: {
    opacity: 0,
    scale: 0.94,
    y: 12,
    transition: {
      opacity: { duration: DUR.medium, ease: EASE.easeIn },
      scale: { duration: DUR.switch, ease: EASE.easeIn },
      y: { duration: DUR.switch, ease: EASE.easeIn },
    },
  },
  incinerateReduced: {
    opacity: 0,
    scale: 0.98,
    y: 0,
    transition: { duration: BURN.reducedCollapseMs / 1000, ease: EASE.easeIn },
  },
  /** Popped-out leave — plays while remaining cards layout-spring upward. */
  exit: {
    opacity: 0,
    scale: 0.94,
    y: 12,
    transition: {
      opacity: { duration: DUR.medium, ease: EASE.easeIn },
      scale: { duration: DUR.switch, ease: EASE.easeIn },
      y: { duration: DUR.switch, ease: EASE.easeIn },
    },
  },
  exitReduced: {
    opacity: 0,
    transition: { duration: BURN.reducedCollapseMs / 1000, ease: EASE.easeIn },
  },
};

/** Sibling zone cards settling into vacated slot (pair with layout + popLayout). */
export const zoneListLayout = {
  type: 'spring' as const,
  visualDuration: 0.34,
  bounce: 0.1,
} as const;

/**
 * Soft panel enter — keep opacity high to avoid blank-frame flicker.
 * Exclusive view swaps (list↔thread, composer↔reader) MUST use
 * AnimatePresence `mode="wait"`. Exit stays ≥0.92, so without wait both
 * views stack (flow) or ghost (absolute inset) as a double header.
 */
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

/**
 * Hero ↔ configure stage swap (same viewport, no stack/scroll).
 * Keep opacity high like contentSwitch — exclusive swaps need mode="wait"
 * (opacity 0 under wait reads as a blank frame; overlapping without wait ghosts).
 */
export const stageSwitch = {
  initial: { opacity: 0.9, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: {
    opacity: 0.9,
    y: -6,
    transition: { duration: DUR.micro, ease: EASE.easeIn },
  },
  transition: { duration: DUR.switch, ease: EASE.outExpo },
};

/** ZONE_BOOT mark settle (full choreography). Soft opacity — avoids empty-frame under splash. */
export const zoneBootMark = {
  initial: { opacity: 0.88, y: 10, scale: 0.88 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: EASE.ritualSpring,
} as const;

/**
 * ZONE_BOOT mark — revisit / post-splash: settle only.
 * High initial opacity — splash already owned the brand beat; opacity 0 reads as flicker.
 */
export const zoneBootMarkShort = {
  /** Near-opaque — post-splash must not flash a second brand beat from low opacity. */
  initial: { opacity: 0.96, scale: 0.99 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: DUR.switch, ease: EASE.outExpo },
} as const;

/** ZONE_BOOT copy / steps / CTAs — soft rise (no blank frame). */
export const zoneBootCopy = {
  initial: { opacity: 0.9, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.switch, ease: EASE.outExpo },
} as const;

/** ZONE_BOOT reduced-motion: soft fade only. */
export const zoneBootReduced = {
  initial: { opacity: 0.92 },
  animate: { opacity: 1 },
  transition: { duration: DUR.micro, ease: EASE.outExpo },
} as const;

/**
 * Zone switch inside Plaza (apagón).
 * Alias of contentSwitch — same opacity-first motor (no scale/blur; Windows GPU).
 * Prefer this name at plaza topic/reader boundaries; pair with mode="wait".
 */
export const enterPlaza = contentSwitch;

/**
 * Shared short panel / disclosure open-close.
 * Opacity-first only — never animate height:'auto' (reflows every frame and fights
 * layout="position" siblings on zone cards). Height open/close belongs to CSS grid
 * `0fr`/`1fr` wrappers (see Presence details) when a soft collapse is required.
 * Exit shorter than enter (Material / NN/g).
 */
export const disclosure = {
  initial: { opacity: 0.92, y: -3 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.medium, ease: EASE.outExpo },
  },
  exit: {
    opacity: 0.92,
    y: -2,
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

/**
 * Toast auto-dismiss TTLs — keep in sync with ToastHost + CSS `--toast-ttl`.
 * Progress bar drains over the same window; hover must pause both.
 */
export const TOAST = {
  successMs: 2500,
  infoMs: 2500,
  warningMs: 4000,
  errorMs: 5000,
} as const;

/** QR secret outer-line ritual — mirror `--dur-secret-frame` / InviteQr. */
export const SECRET_FRAME_MS = 820;

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
 * (theme, copy, secret phrase, lang). Soft opacity — avoid chrome flicker.
 */
export const iconSwap = {
  initial: { opacity: 0.85, scale: 0.9, y: 2 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: {
    opacity: 0.85,
    scale: 0.9,
    y: -2,
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
