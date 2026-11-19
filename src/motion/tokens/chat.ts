import { DUR, EASE } from './base';
import { NAV_INDICATOR } from './chrome';

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
