/** Utilidades ligeras: hex aleatorio, alias e identicon desde userId Trystero. */

const ALIAS_WORDS = [
  'Bruma',
  'Nómada',
  'Estela',
  'Deriva',
  'Senda',
  'Vigía',
  'Eco',
  'Marea',
  'Faro',
  'Silbo',
  'Cruce',
  'Velo',
  'Ámbar',
  'Cauce',
  'Sombra',
  'Ráfaga',
];

export interface LocalProfile {
  alias: string;
  fingerprintHex: string;
  identiconMatrix: boolean[];
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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

/** Sync identicon from a zone/room hex id (no WebCrypto). */
export function identiconMatrixFromHex(hex: string): boolean[] {
  const clean = hex.replace(/[^0-9a-f]/gi, '').toLowerCase().padEnd(64, '0');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return buildIdenticonFromHash(bytes);
}

export async function visualFromUserId(userId: string): Promise<{
  fingerprintHex: string;
  identiconMatrix: boolean[];
}> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`tazia:uid:${userId}`)
  );
  const hashBytes = new Uint8Array(digest);
  return {
    fingerprintHex: bytesToHex(hashBytes.slice(0, 8)),
    identiconMatrix: buildIdenticonFromHash(hashBytes),
  };
}

export function suggestAliasFromFingerprint(fingerprintHex: string): string {
  const n = Number.parseInt(fingerprintHex.slice(0, 4), 16);
  if (!Number.isFinite(n)) return 'Nómada';
  const word = ALIAS_WORDS[n % ALIAS_WORDS.length] ?? 'Nómada';
  const suffix = fingerprintHex.slice(0, 4).toUpperCase();
  return `${word}-${suffix}`;
}

export async function buildLocalProfile(userId: string, customAlias?: string): Promise<LocalProfile> {
  const visual = await visualFromUserId(userId);
  const alias =
    customAlias?.trim() ||
    suggestAliasFromFingerprint(visual.fingerprintHex);
  return {
    alias,
    fingerprintHex: visual.fingerprintHex,
    identiconMatrix: visual.identiconMatrix,
  };
}
