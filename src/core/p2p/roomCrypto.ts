/** Room-phrase AES-GCM helpers for the Nostr data-plane fallback (v2 KDF + padding). */

const te = new TextEncoder();
const td = new TextDecoder();

const PBKDF2_ITERATIONS = 210_000;
const PAD_BLOCK = 256;
/** Wire blob: version byte + IV(12) + ciphertext(+pad). */
const BLOB_VERSION = 0x02;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deriveMasterBits(roomId: string, password: string): Promise<ArrayBuffer> {
  const material = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: te.encode(`tazia.fallback.v2:${roomId}`),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    256
  );
}

async function hkdfExpand(
  master: ArrayBuffer,
  info: string,
  lengthBits: number
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', master, 'HKDF', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: te.encode(info),
    },
    key,
    lengthBits
  );
}

export async function deriveRoomKey(roomId: string, password: string): Promise<CryptoKey> {
  const master = await deriveMasterBits(roomId, password);
  const bits = await hkdfExpand(master, 'tazia.app/room-key', 256);
  return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function fallbackTopic(roomId: string, password: string): Promise<string> {
  const master = await deriveMasterBits(roomId, password);
  const bits = await hkdfExpand(master, 'tazia.app/topic', 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Unified session material (room AES key + Nostr topic id). */
export async function deriveSessionMaterial(
  roomId: string,
  phrase: string
): Promise<{ roomKey: CryptoKey; topicId: string }> {
  const [roomKey, topicId] = await Promise.all([
    deriveRoomKey(roomId, phrase),
    fallbackTopic(roomId, phrase),
  ]);
  return { roomKey, topicId };
}

function padPlaintext(plain: Uint8Array): Uint8Array {
  const len = plain.length;
  const total = Math.ceil((len + 2) / PAD_BLOCK) * PAD_BLOCK;
  const out = new Uint8Array(total);
  out[0] = (len >> 8) & 0xff;
  out[1] = len & 0xff;
  out.set(plain, 2);
  return out;
}

function unpadPlaintext(padded: Uint8Array): Uint8Array {
  if (padded.length < 2) throw new Error('pad too short');
  const len = (padded[0]! << 8) | padded[1]!;
  if (len < 0 || len + 2 > padded.length) throw new Error('bad pad length');
  return padded.subarray(2, 2 + len);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = padPlaintext(te.encode(JSON.stringify(value)));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, toArrayBuffer(plain))
  );
  const packed = new Uint8Array(1 + iv.length + cipher.length);
  packed[0] = BLOB_VERSION;
  packed.set(iv, 1);
  packed.set(cipher, 1 + iv.length);
  return bytesToB64(packed);
}

export async function decryptJson<T>(key: CryptoKey, payloadB64: string): Promise<T | null> {
  try {
    const packed = b64ToBytes(payloadB64);
    if (packed.length < 14 || packed[0] !== BLOB_VERSION) return null;
    const iv = packed.slice(1, 13);
    const cipher = packed.slice(13);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, toArrayBuffer(cipher))
    );
    return JSON.parse(td.decode(unpadPlaintext(plain))) as T;
  } catch {
    return null;
  }
}
