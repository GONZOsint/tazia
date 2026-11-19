export type FireRgb = { r: number; g: number; b: number };

export type FirePalette = {
  core: FireRgb;
  mid: FireRgb;
  edge: FireRgb;
  tip: FireRgb;
};

const FIRE_FALLBACK: FirePalette = {
  core: { r: 0xe8, g: 0xb8, b: 0x4a },
  mid: { r: 0xc9, g: 0x78, b: 0x0a },
  edge: { r: 0x9a, g: 0x4f, b: 0x0a },
  tip: { r: 0xff, g: 0xfa, b: 0xc8 },
};

function parseHexRgb(hex: string): FireRgb | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function lightenRgb(c: FireRgb, t: number): FireRgb {
  return {
    r: Math.round(c.r + (255 - c.r) * t),
    g: Math.round(c.g + (255 - c.g) * t),
    b: Math.round(c.b + (255 - c.b) * t),
  };
}

export function rgbaFire(c: FireRgb, a: number): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

let firePalette: FirePalette = { ...FIRE_FALLBACK, tip: { ...FIRE_FALLBACK.tip } };

/** Snapshot --fire-* tokens for canvas particles (call at burn / QR fire start). */
export function refreshFirePalette(root: Element = document.documentElement): FirePalette {
  const cs = getComputedStyle(root);
  const core = parseHexRgb(cs.getPropertyValue('--fire-core').trim()) ?? FIRE_FALLBACK.core;
  const mid = parseHexRgb(cs.getPropertyValue('--fire-mid').trim()) ?? FIRE_FALLBACK.mid;
  const edge = parseHexRgb(cs.getPropertyValue('--fire-edge').trim()) ?? FIRE_FALLBACK.edge;
  firePalette = {
    core,
    mid,
    edge,
    tip: lightenRgb(core, 0.72),
  };
  return firePalette;
}

export function getFirePalette(): FirePalette {
  return firePalette;
}

export function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
