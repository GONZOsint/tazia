/**
 * Builds src/core/avatar/flameEngine.ts from the extracted mock script.
 * Strips picker UI; adds seeded RNG + mount/destroy API.
 */
import fs from 'node:fs';

const mockPath = new URL('../src/core/avatar/_mock_script.js', import.meta.url);
const outPath = new URL('../src/core/avatar/flameEngine.ts', import.meta.url);
let src = fs.readFileSync(mockPath, 'utf8');

// Strip IIFE wrapper
src = src.replace(/^\s*\(\(\)\s*=>\s*\{/, '');
src = src.replace(/\}\)\(\);\s*$/, '');

// Remove DOM UI bootstrap at top (root/grid/buttons)
src = src.replace(
  /const root = document\.getElementById\('flame-maker'\);[\s\S]*?const themeButtons = \[\.\.\.root\.querySelectorAll\('\[data-theme-opt\]'\)\];\s*/,
  ''
);

// Remove UI-only functions and bootstrapping at the end (from selectAvatar / generate / downloads)
const cutMarkers = [
  'function selectAvatar',
  'function updateSelectionPreview',
  'function buildStandaloneSvgMarkup',
  'function downloadPng',
  'function rerollAvatar',
  'function generate',
];
let cutAt = -1;
for (const m of cutMarkers) {
  const i = src.indexOf(m);
  if (i >= 0 && (cutAt < 0 || i < cutAt)) cutAt = i;
}
// Also cut event listeners / generate() at end if still present after makeAvatar
const makeAvatarEnd = src.lastIndexOf('function makeAvatar');
// Find end of makeAvatar by locating "function rerollAvatar" or "function generate"
const afterMake = src.indexOf('function rerollAvatar', makeAvatarEnd);
const afterMake2 = src.indexOf('function generate', makeAvatarEnd);
const trimFrom = Math.min(
  ...[afterMake, afterMake2, src.indexOf('frameButtons.forEach'), src.indexOf('btnRerollSelected')].filter(
    (n) => n > 0
  )
);

if (trimFrom > 0) {
  // Keep through end of makeAvatar — find the closing of makeAvatar before trimFrom
  src = src.slice(0, trimFrom);
}

// Remove remaining UI helpers that sit before makeAvatar
for (const fn of [
  'function selectAvatar',
  'function updateSelectionPreview',
  'function rasterizeSelected',
  'function buildStandaloneSvgMarkup',
  'function downloadPng',
  'function setTheme',
  'function applyThemeToAvatar',
]) {
  // no-op if already trimmed
}

// Remove setTheme / download / selection helpers between syncLoop and buildFixedInkBreaks if present
src = src.replace(/function setTheme\([\s\S]*?(?=function buildFixedInkBreaks)/, '');
src = src.replace(/function applyThemeToAvatar\([\s\S]*?(?=function makeAvatar|function buildFixedInkBreaks)/, '');

// Replace Math.random with rng()
src = src.replace(/Math\.random\(\)/g, 'rng()');

// themeMode should be injectable
src = src.replace(
  /let frameMode = 'circle';\s*let themeMode =[\s\S]*?let selectedCtrl = null;/,
  `let themeMode: 'light' | 'dark' = 'light';`
);

// Remove card/picker creation from makeAvatar — we'll rewrite makeAvatar return via post-process
// Replace the card UI block at end of makeAvatar with just returning svg ctrl

const cardBlockStart = src.indexOf("svg.style.setProperty('--pop-delay'");
if (cardBlockStart > 0) {
  const returnIdx = src.indexOf('return avatarCtrl;', cardBlockStart);
  if (returnIdx > 0) {
    const before = src.slice(0, cardBlockStart);
    const afterReturn = src.slice(returnIdx);
    src =
      before +
      `
    svg.style.setProperty('--blink-speed', \`\${rand(6.2, 8.6).toFixed(2)}s\`);
    svg.style.setProperty('--blink-delay', \`\${rand(-8.0, 0).toFixed(2)}s\`);

    stepAvatar(avatarCtrl, performance.now() * 0.001, 0.016);
    activeAvatars.add(avatarCtrl);
    syncLoop();

    ` +
      afterReturn;
  }
}

// Remove references to card/pickBtn in avatarCtrl init
src = src.replace(
  /uid, svg, card: null, pickBtn: null,\s*/,
  'uid, svg, '
);

const header = `/**
 * Flame avatar engine — ported from ai_studio_code(6).html mock.
 * Seeded geometry + shared rAF ticker (breathe, blink CSS, embers).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const NS = 'http://www.w3.org/2000/svg';

export type FlameThemeMode = 'light' | 'dark';

let rngState = 0x9e3779b9;

function rng(): number {
  // xorshift32
  let x = rngState | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  rngState = x | 0;
  return ((x >>> 0) % 1_000_000) / 1_000_000;
}

function setRngSeed(seed: number): void {
  rngState = (seed >>> 0) || 0xA5A5A5A5;
}

`;

// Fix: remove duplicate `const NS = ...` if still in body
src = src.replace(/const NS = 'http:\/\/www\.w3\.org\/2000\/svg';\s*/, '');

// Remove leftover UI var refs that break compile
src = src.replace(/const grid =[\s\S]*?;\s*/g, '');
src = src.replace(/document\.documentElement\.dataset\.theme[\s\S]*?;\s*/g, '');
src = src.replace(/root\.dataset\.theme[\s\S]*?;\s*/g, '');

const footer = `

export interface FlameAvatarHandle {
  svg: SVGSVGElement;
  seed: string;
  setTheme: (mode: FlameThemeMode) => void;
  destroy: () => void;
}

import {
  decodeAvatarSeed,
  encodeAvatarSeed,
  type AvatarSeedParts,
  PALETTE_COUNT,
  FLAME_STYLE_COUNT,
  EYE_STYLE_COUNT,
  MOUTH_STYLE_COUNT,
  DETAIL_STYLE_COUNT,
} from './avatarSeed';

function themeFromDom(): FlameThemeMode {
  if (typeof document === 'undefined') return 'light';
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'dark' ? 'dark' : 'light';
}

function makeAvatarFromParts(parts: AvatarSeedParts, label?: string): any {
  setRngSeed(parts.entropy);
  themeMode = themeFromDom();
  const palette = PALETTES[parts.paletteIndex % PALETTES.length];
  const flameStyle = FLAME_STYLES[parts.flameIndex % FLAME_STYLES.length];
  const eyeStyle = EYE_STYLES[parts.eyeIndex % EYE_STYLES.length];
  const mouthStyle = MOUTH_STYLES[parts.mouthIndex % MOUTH_STYLES.length];
  const detailStyle = DETAIL_STYLES[parts.detailIndex % DETAIL_STYLES.length];
  const ctrl = makeAvatar(0, {
    palette,
    flameStyle,
    eyeStyle,
    mouthStyle,
    detailStyle,
  });
  if (label) {
    ctrl.svg.setAttribute('aria-label', label);
  }
  return ctrl;
}

export function mountFlameAvatar(
  host: HTMLElement,
  seed: string,
  opts?: { label?: string; theme?: FlameThemeMode }
): FlameAvatarHandle | null {
  const parts = decodeAvatarSeed(seed);
  if (!parts) return null;
  if (opts?.theme) themeMode = opts.theme;
  const ctrl = makeAvatarFromParts(parts, opts?.label);
  // Prefer squircle clip via CSS on host; strip full-bleed bg rect for dense UI
  host.replaceChildren(ctrl.svg);
  ctrl.svg.style.width = '100%';
  ctrl.svg.style.height = '100%';
  ctrl.svg.style.display = 'block';

  const handle: FlameAvatarHandle = {
    svg: ctrl.svg,
    seed,
    setTheme(mode) {
      themeMode = mode;
      const bg = THEME_BGS[themeMode];
      ctrl.bgStop1.setAttribute('stop-color', bg.bg1);
      ctrl.bgStop2.setAttribute('stop-color', bg.bg2);
      ctrl.bgGlowStop1.setAttribute('stop-opacity', themeMode === 'dark' ? '0.32' : '0.24');
    },
    destroy() {
      activeAvatars.delete(ctrl);
      syncLoop();
      if (ctrl.svg.parentElement === host) host.replaceChildren();
    },
  };
  return handle;
}

export { setRngSeed, encodeAvatarSeed, decodeAvatarSeed };
`;

const out = header + src + footer;
fs.writeFileSync(outPath, out);
console.log('wrote', outPath.pathname, 'bytes', out.length);
