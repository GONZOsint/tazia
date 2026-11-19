/** Utilidades ligeras: hex aleatorio, alias e identicon desde userId Trystero. */
import { randomAvatarSeed } from '../avatar/avatarSeed';

/** Adjetivos atmosféricos (tono TAZIA); índice desde fingerprint. */
const ALIAS_ADJECTIVES = [
  'Serena',
  'Brumosa',
  'Nómada',
  'Lúcida',
  'Quieta',
  'Áurea',
  'Clara',
  'Dócil',
  'Fugaz',
  'Húmeda',
  'Íntima',
  'Lenta',
  'Mansa',
  'Nítida',
  'Ónice',
  'Pálida',
  'Rara',
  'Suave',
  'Tibia',
  'Única',
  'Viva',
  'Ágil',
  'Baja',
  'Cálida',
  'Densa',
  'Ética',
  'Firme',
  'Gris',
  'Hiriente',
  'Inmóvil',
  'Joven',
  'Leve',
  'Muda',
  'Nueva',
  'Oscura',
  'Pura',
  'Rota',
  'Sutil',
  'Tensa',
  'Útil',
  'Verde',
  'Ácida',
  'Breve',
  'Ciega',
  'Dulce',
  'Etérea',
  'Fría',
  'Grave',
  'Hueca',
  'Ígnea',
  'Justa',
  'Libre',
  'Morada',
  'Noble',
  'Oculta',
  'Plana',
  'Rápida',
  'Seca',
  'Trémula',
  'Urbana',
  'Vacía',
  'Ámbar',
  'Remota',
  'Dorada',
] as const;

/** Sustantivos atmosféricos; índice desde fingerprint. */
const ALIAS_NOUNS = [
  'Marea',
  'Bruma',
  'Estela',
  'Deriva',
  'Senda',
  'Vigía',
  'Eco',
  'Faro',
  'Silbo',
  'Cruce',
  'Velo',
  'Cauce',
  'Sombra',
  'Ráfaga',
  'Ágora',
  'Alba',
  'Aura',
  'Bahía',
  'Cima',
  'Duna',
  'Eclipse',
  'Fuente',
  'Grieta',
  'Horizonte',
  'Isla',
  'Juncia',
  'Luna',
  'Niebla',
  'Orilla',
  'Puente',
  'Quicio',
  'Risco',
  'Soto',
  'Tramo',
  'Umbral',
  'Valle',
  'Oasis',
  'Brezo',
  'Cieno',
  'Delta',
  'Erial',
  'Fronda',
  'Glera',
  'Huerto',
  'Ibera',
  'Jara',
  'Linde',
  'Mirador',
  'Nicho',
  'Ocaso',
  'Peñón',
  'Ribera',
  'Salina',
  'Tajo',
  'Uva',
  'Vado',
  'Yermo',
  'Zarzal',
  'Arroyo',
  'Bosque',
  'Cañón',
  'Desfiladero',
  'Espuma',
  'Fosa',
] as const;

export interface IdenticonColors {
  fg: string;
  bg: string;
}

export interface IdenticonVisual extends IdenticonColors {
  identiconMatrix: boolean[];
}

export interface PeerVisual extends IdenticonVisual {
  fingerprintHex: string;
  suggestedAlias: string;
}

export interface LocalProfile extends PeerVisual {
  alias: string;
  /** Random flame avatar seed for this zone session. */
  avatarSeed: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string, byteLength: number): Uint8Array {
  const clean = hex.replace(/[^0-9a-f]/gi, '').toLowerCase().padEnd(byteLength * 2, '0');
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return bytes;
}

export function generateRandomHex(byteCount = 8): string {
  const buf = new Uint8Array(byteCount);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

function buildIdenticonFromHash(hashBytes: Uint8Array): boolean[] {
  const matrix: boolean[] = new Array(25).fill(false);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const bitIndex = row * 3 + col;
      const byteVal = hashBytes[Math.floor(bitIndex / 8)] ?? 0;
      const on = ((byteVal >> (bitIndex % 8)) & 1) === 1;
      matrix[row * 5 + col] = on;
      matrix[row * 5 + (4 - col)] = on;
    }
  }
  return matrix;
}

/** HSL → hex sRGB (s/l en 0–100). */
function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    r = c;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = c;
  } else if (hp < 3) {
    g = c;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const m = light - c / 2;
  const toByte = (v: number) => Math.round((v + m) * 255);
  return `#${[toByte(r), toByte(g), toByte(b)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Color de identidad desde hash: tinta saturada + plato suave
 * (contraste estable en light/dark del tema).
 */
export function colorsFromHash(hashBytes: Uint8Array): IdenticonColors {
  const hue = ((hashBytes[8] ?? 0) << 1) | ((hashBytes[9] ?? 0) >> 7);
  const h = hue % 360;
  return {
    fg: hslToHex(h, 52, 38),
    bg: hslToHex(h, 28, 88),
  };
}

function visualFromHashBytes(hashBytes: Uint8Array): IdenticonVisual {
  const colors = colorsFromHash(hashBytes);
  return {
    identiconMatrix: buildIdenticonFromHash(hashBytes),
    fg: colors.fg,
    bg: colors.bg,
  };
}

/** Sync identicon + color from a zone/room hex id (no WebCrypto). */
export function identiconVisualFromHex(hex: string): IdenticonVisual {
  return visualFromHashBytes(hexToBytes(hex, 32));
}

/** @deprecated Prefer identiconVisualFromHex — matrix only. */
export function identiconMatrixFromHex(hex: string): boolean[] {
  return identiconVisualFromHex(hex).identiconMatrix;
}

const peerVisualCache = new Map<string, PeerVisual>();

/** Sync read of a visual already computed via visualFromUserId. */
export function cachedPeerVisual(userId: string): PeerVisual | undefined {
  return peerVisualCache.get(userId);
}

export async function visualFromUserId(userId: string): Promise<PeerVisual> {
  const hit = peerVisualCache.get(userId);
  if (hit) return hit;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`tazia:uid:${userId}`)
  );
  const hashBytes = new Uint8Array(digest);
  const fingerprintHex = bytesToHex(hashBytes.slice(0, 8));
  const visual = visualFromHashBytes(hashBytes);
  const peer: PeerVisual = {
    fingerprintHex,
    suggestedAlias: suggestAliasFromFingerprint(fingerprintHex),
    ...visual,
  };
  peerVisualCache.set(userId, peer);
  return peer;
}

export function suggestAliasFromFingerprint(fingerprintHex: string): string {
  const bytes = hexToBytes(fingerprintHex, 8);
  const adjIdx = ((bytes[0] ?? 0) << 8) | (bytes[1] ?? 0);
  const nounIdx = ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);
  const adj = ALIAS_ADJECTIVES[adjIdx % ALIAS_ADJECTIVES.length] ?? 'Nómada';
  const noun = ALIAS_NOUNS[nounIdx % ALIAS_NOUNS.length] ?? 'Deriva';
  return `${adj} ${noun}`;
}

export async function buildLocalProfile(
  userId: string,
  customAlias?: string,
  avatarSeed?: string
): Promise<LocalProfile> {
  const visual = await visualFromUserId(userId);
  const alias = customAlias?.trim() || visual.suggestedAlias;
  return {
    ...visual,
    alias,
    avatarSeed: avatarSeed && avatarSeed.length > 0 ? avatarSeed : randomAvatarSeed(),
  };
}
