/** Room-phrase AES-GCM helpers for the Nostr data-plane fallback. */

const te = new TextEncoder();
const td = new TextDecoder();

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

export async function deriveRoomKey(roomId: string, password: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: te.encode(`tazia.fallback.v1:${roomId}`),
      iterations: 120_000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function fallbackTopic(roomId: string, password: string): Promise<string> {
  const dig = await crypto.subtle.digest(
    'SHA-256',
    te.encode(`tazia.fallback.topic.v1:${roomId}:${password}`)
  );
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = te.encode(JSON.stringify(value));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv, 0);
  packed.set(cipher, iv.length);
  return bytesToB64(packed);
}

export async function decryptJson<T>(key: CryptoKey, payloadB64: string): Promise<T | null> {
  try {
    const packed = b64ToBytes(payloadB64);
    if (packed.length < 13) return null;
    const iv = packed.slice(0, 12);
    const cipher = packed.slice(12);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return JSON.parse(td.decode(plain)) as T;
  } catch {
    return null;
  }
}
