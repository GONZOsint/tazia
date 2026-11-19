import { DUR, EASE } from './base';
import { REGION_ASH } from './climax';

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

const zoneCardExitMotion = {
  opacity: 0,
  scale: 0.94,
  y: 12,
  transition: {
    opacity: { duration: DUR.medium, ease: EASE.easeIn },
    scale: { duration: DUR.switch, ease: EASE.easeIn },
    y: { duration: DUR.switch, ease: EASE.easeIn },
  },
} as const;

const zoneCardExitReducedMotion = {
  opacity: 0,
  transition: { duration: REGION_ASH.reducedMs / 1000, ease: EASE.easeIn },
} as const;

/**
 * Cold leave (zone card) — reduced-motion / fallback only.
 * Full motion uses RegionAshOverlay (ZONE_ASH) then instant unmount — do not pair
 * Motion exit with `.incinerated-collapse` (opacity/filter/transform fight).
 *
 * Reduced choreography: optimistic unmount → AnimatePresence popLayout `exit`
 * while siblings spring via `zoneListLayout`.
 */
export const zoneCardExit = {
  initial: { opacity: 1, scale: 1, y: 0 },
  /** Popped-out leave — plays while remaining cards layout-spring upward. */
  exit: zoneCardExitMotion,
  exitReduced: zoneCardExitReducedMotion,
  /** @deprecated Prefer `exit` — kept for any leftover incinerate callers. */
  incinerate: zoneCardExitMotion,
  incinerateReduced: {
    opacity: 0,
    scale: 0.98,
    y: 0,
    transition: { duration: REGION_ASH.reducedMs / 1000, ease: EASE.easeIn },
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
 * Zone switch inside Forum (apagón).
 * Alias of contentSwitch — same opacity-first motor (no scale/blur; Windows GPU).
 * Prefer this name at forum topic/reader boundaries; pair with mode="wait".
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
