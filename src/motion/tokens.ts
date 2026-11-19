/**
 * Canonical motion tokens — keep in sync with `--dur-*` in styles/index.css.
 *
 * Engine contract (one motor per gesture):
 *   - Frequent chrome taps / panel fades → Motion duration tweens (TAP, contentSwitch)
 *   - Send plane → Motion useAnimate only (no CSS .plane-launching)
 *   - Session flame dying → FireBurnButton WebGL extinguish + CSS (.is-dying) + BurnFireOverlay
 *   - Zone ignite → CSS + IGNITE (“encender”)
 *   - Zone burn (leave) → RegionAshOverlay mode=burn (ZONE_ASH);
 *     reduced-motion → Motion zoneCardExit + zoneListLayout
 *   - Hoguera extinguish (thread delete) → RegionAshOverlay / TalkAshOverlay mode=extinguish
 *   - Hero burn phrase → CSS goo plume (#tazia-fire-plume) behind sharp type
 *   - Hero idle presence → CSS breath/sheen + JS nudge/parallax (HERO_IDLE; paused when hidden / reduced)
 *   - App entrance → APP_SPLASH then ZONE_BOOT (ritual; no confetti / no canvas)
 *   - Confetti / seal / mesh birth → Motion presets (ritual tier; confetti = create+verify only)
 *
 * Tiers (NN/g + Fluent hierarchy):
 *   frequent ≤150ms  |  panel ~200–220ms  |  ritual ≤400ms spring  |  climax BURN ~1.5s
 *
 * CSS sync notes:
 *   - `--dur-burn` (900ms) = card collapse window; `BURN.finishMs` (2200) = canvas teardown
 *   - `DUR.burn` (0.68s) is Motion-only — not `--dur-burn`
 *   - Pixel front ends at ~85% of finishMs (`BURN_FRONT_DURATION_RATIO` in fire/burnFrame)
 *
 * Implementation lives under `./tokens/*`; this file is the stable barrel.
 */

export { MOTION_TIER, DUR, EASE } from './tokens/base';
export {
  BURN,
  REGION_ASH,
  ZONE_ASH,
  EXTINGUISH,
  TALK_EXTINGUISH,
  TALK_ASH,
  IGNITE,
} from './tokens/climax';
export { APP_SPLASH, ZONE_BOOT, HERO_IDLE } from './tokens/boot';
export { CONFETTI, VERIFY, MESH_BIRTH, TOAST, SECRET_FRAME_MS } from './tokens/ritual';
export {
  TAP,
  TAP_TRANSITION,
  NAV_INDICATOR,
  NAV_TAP,
  zoneCardExit,
  zoneListLayout,
  contentSwitch,
  panelEnter,
  stageSwitch,
  zoneBootMark,
  zoneBootMarkShort,
  zoneBootCopy,
  zoneBootReduced,
  enterPlaza,
  disclosure,
  modalScrim,
  modalSheet,
  toastEnter,
  listRowEnter,
  forgeEnter,
  peerMaterialize,
  peerRowEnter,
  peerRowExit,
  badgePop,
  badgeMelt,
  bannerEnter,
  iconSwap,
} from './tokens/chrome';
export {
  bubbleEnter,
  bubbleEnterReduced,
  bubbleEnterFromSend,
  firstContentEnter,
  resolveBubbleEnter,
  bubbleOrigin,
  postOrigin,
  sealIcon,
  sealFlash,
  drawerPanel,
  staggerChild,
  type BubbleEnterOpts,
} from './tokens/chat';
