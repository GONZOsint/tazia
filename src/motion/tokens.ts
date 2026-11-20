/**
 * Canonical motion tokens — keep in sync with `--dur-*` in styles/tokens.css.
 *
 * Engine contract (one motor per gesture):
 *   - Frequent chrome taps / panel fades → Motion duration tweens (TAP, contentSwitch)
 *   - Send plane → Motion useAnimate only (no CSS .plane-launching)
 *   - Session enter burn → WebGL `igniteBurn` (pill+curl)
 *   - Session flame dying → FireBurnButton WebGL extinguish + CSS (.is-dying)
 *   - Zone ignite → CSS + IGNITE (“encender”)
 *   - Zone leave → Motion zoneCardExit
 *   - Invite QR secret fire → WebGL `qrFire`
 *   - Hero burn phrase → CSS `.hero-burn-phrase*` behind sharp type
 *   - Hero idle presence → CSS breath/sheen + JS nudge/parallax (HERO_IDLE; paused when hidden / reduced)
 *   - App entrance → APP_SPLASH then ZONE_BOOT (ritual; no confetti / no canvas)
 *   - Confetti / seal / mesh birth → Motion presets (ritual tier; confetti = create+verify only)
 *
 * Tiers (NN/g + Fluent hierarchy):
 *   frequent ≤150ms  |  panel ~200–220ms  |  ritual ≤400ms spring  |  climax extinguish ~720ms
 *
 * Implementation lives under `./tokens/*`; this file is the stable barrel.
 */

export { DUR, EASE } from './tokens/base';
export { BURN, IGNITE } from './tokens/climax';
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
  zoneBootCta,
  zoneBootReduced,
  enterPlaza,
  disclosure,
  modalScrim,
  modalSheet,
  toastEnter,
  listRowEnter,
  forgeEnter,
  peerMaterialize,
  peerRowExit,
  badgePop,
  badgeMelt,
  iconSwap,
} from './tokens/chrome';
export {
  resolveBubbleEnter,
  bubbleOrigin,
  postOrigin,
  sealIcon,
  sealFlash,
  drawerPanel,
  staggerChild,
  type BubbleEnterOpts,
} from './tokens/chat';
