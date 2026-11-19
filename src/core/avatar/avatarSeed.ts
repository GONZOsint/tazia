/** Compact flame avatar seed for presence wire + deterministic render. */

export const AVATAR_SEED_VERSION = 1;
export const MAX_AVATAR_SEED_CHARS = 32;

export const FLAME_PALETTE_IDS = [
  'lima_marca',
  'lima_neon',
  'lima_menta',
  'lima_cian',
  'lima_bosque',
  'lima_citrica',
  'lima_crema',
] as const;

export const FLAME_STYLE_IDS = [
  'calcifer_classic',
  'calcifer_spiky',
  'calcifer_wild',
  'calcifer_tall',
  'calcifer_tuft',
  'calcifer_cozy',
  'calcifer_twin',
] as const;

export const EYE_STYLE_IDS = [
  'calcifer_angry_up',
  'calcifer_half_up',
  'calcifer_chewing_lids',
  'calcifer_wide_ring',
  'calcifer_puppy_up',
  'calcifer_fierce_white',
  'calcifer_blank_dot',
  'calcifer_happy_arcs',
  'calcifer_squint_laugh',
  'calcifer_star',
] as const;

export const MOUTH_STYLE_IDS = [
  'calcifer_bell_frown',
  'calcifer_bean_laugh',
  'calcifer_wavy_open',
  'calcifer_wide_gasp',
  'calcifer_tiny_smile',
  'calcifer_wide_evil_grin',
  'calcifer_tiny_dash',
  'calcifer_open_happy',
  'calcifer_fang_smile',
] as const;

export const DETAIL_STYLE_IDS = ['highlights', 'blush_dots', 'embers', 'clean'] as const;

export const PALETTE_COUNT = FLAME_PALETTE_IDS.length;
export const FLAME_STYLE_COUNT = FLAME_STYLE_IDS.length;
export const EYE_STYLE_COUNT = EYE_STYLE_IDS.length;
export const MOUTH_STYLE_COUNT = MOUTH_STYLE_IDS.length;
export const DETAIL_STYLE_COUNT = DETAIL_STYLE_IDS.length;

export interface AvatarSeedParts {
  paletteIndex: number;
  flameIndex: number;
  eyeIndex: number;
  mouthIndex: number;
  detailIndex: number;
  /** u32 entropy for procedural geometry */
  entropy: number;
}

const SEED_RE =
  /^v1\.(\d+)\.(\d+)\.(\d+)\.(\d+)\.(\d+)\.([0-9a-fA-F]{1,8})$/;

function clampIndex(n: number, max: number): number | null {
  if (!Number.isInteger(n) || n < 0 || n >= max) return null;
  return n;
}

export function encodeAvatarSeed(parts: AvatarSeedParts): string {
  const hex = (parts.entropy >>> 0).toString(16).padStart(8, '0');
  return `v1.${parts.paletteIndex}.${parts.flameIndex}.${parts.eyeIndex}.${parts.mouthIndex}.${parts.detailIndex}.${hex}`;
}

export function decodeAvatarSeed(seed: string): AvatarSeedParts | null {
  if (typeof seed !== 'string' || seed.length === 0 || seed.length > MAX_AVATAR_SEED_CHARS) {
    return null;
  }
  const m = SEED_RE.exec(seed);
  if (!m) return null;
  const paletteIndex = clampIndex(Number(m[1]), PALETTE_COUNT);
  const flameIndex = clampIndex(Number(m[2]), FLAME_STYLE_COUNT);
  const eyeIndex = clampIndex(Number(m[3]), EYE_STYLE_COUNT);
  const mouthIndex = clampIndex(Number(m[4]), MOUTH_STYLE_COUNT);
  const detailIndex = clampIndex(Number(m[5]), DETAIL_STYLE_COUNT);
  if (
    paletteIndex === null ||
    flameIndex === null ||
    eyeIndex === null ||
    mouthIndex === null ||
    detailIndex === null
  ) {
    return null;
  }
  const entropy = Number.parseInt(m[6], 16);
  if (!Number.isFinite(entropy)) return null;
  return { paletteIndex, flameIndex, eyeIndex, mouthIndex, detailIndex, entropy: entropy >>> 0 };
}

export function isValidAvatarSeed(value: unknown): value is string {
  return typeof value === 'string' && decodeAvatarSeed(value) !== null;
}

/** Mouth pools matching mock `pickHarmoniousFace`. */
const MOUTH_POOLS: Record<string, readonly number[]> = {
  calcifer_angry_up: [0, 3],
  calcifer_half_up: [1, 7],
  calcifer_chewing_lids: [2, 3, 8],
  calcifer_happy_arcs: [7, 1, 4],
  calcifer_squint_laugh: [7, 1, 4],
  calcifer_wide_ring: [3, 7, 4],
  calcifer_puppy_up: [1, 7, 8],
  calcifer_star: [1, 7, 8],
  calcifer_fierce_white: [5, 8, 7],
  calcifer_blank_dot: [6, 3],
};

/** Random seed using the same combinatorial spirit as the mock generator. */
export function randomAvatarSeed(): string {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  const entropy = buf[0] >>> 0;
  let x = buf[1] >>> 0;
  const next = (mod: number) => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x % mod;
  };
  const eyeIndex = next(EYE_STYLE_COUNT);
  const eyeId = EYE_STYLE_IDS[eyeIndex];
  const pool = MOUTH_POOLS[eyeId];
  const mouthIndex = pool ? pool[next(pool.length)]! : next(MOUTH_STYLE_COUNT);
  return encodeAvatarSeed({
    paletteIndex: next(PALETTE_COUNT),
    flameIndex: next(FLAME_STYLE_COUNT),
    eyeIndex,
    mouthIndex,
    detailIndex: next(DETAIL_STYLE_COUNT),
    entropy,
  });
}
