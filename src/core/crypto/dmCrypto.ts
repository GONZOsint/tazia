/** Pairwise Susurro sealing: X25519 ECDH + AES-GCM (optional; falls back to plaintext). */

const te = new TextEncoder();
const td = new TextDecoder();

export interface EncryptionIdentity {
  publicKeyRawB64: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

let x25519Ok: boolean | null = null;

export async function supportsX25519(): Promise<boolean> {
  if (x25519Ok !== null) return x25519Ok;
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    x25519Ok = false;
    return false;
  }
  try {
    const pair = (await crypto.subtle.generateKey(
      { name: 'X25519' } as AlgorithmIdentifier,
      false,
      ['deriveBits']
    )) as CryptoKeyPair;
    x25519Ok = Boolean(pair?.privateKey && pair?.publicKey);
  } catch {
    x25519Ok = false;
  }
  return x25519Ok;
}

export async function generateEncryptionIdentity(): Promise<EncryptionIdentity | null> {
  if (!(await supportsX25519())) return null;
  const keyPair = (await crypto.subtle.generateKey(
    { name: 'X25519' } as AlgorithmIdentifier,
    false,
    ['deriveBits']
  )) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  return {
    publicKeyRawB64: bytesToB64(raw),
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
  };
}

async function importPeerPublic(rawB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    toArrayBuffer(b64ToBytes(rawB64)),
    { name: 'X25519' } as AlgorithmIdentifier,
    false,
    []
  );
}

async function sharedAesKey(
  privateKey: CryptoKey,
  peerPublicRawB64: string
): Promise<CryptoKey> {
  const peerPub = await importPeerPublic(peerPublicRawB64);
  const bits = await crypto.subtle.deriveBits(
    // X25519 is not yet in all TS DOM libs.
    { name: 'X25519', public: peerPub } as unknown as AlgorithmIdentifier,
    privateKey,
    256
  );
  const hkdfKey = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: te.encode('tazia.app/dm-v2'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Returns base64(iv||ciphertext) or null if sealing unavailable. */
export async function sealDmBody(
  plaintext: string,
  selfEnc: EncryptionIdentity,
  peerEncPubB64: string
): Promise<string | null> {
  try {
    const key = await sharedAesKey(selfEnc.privateKey, peerEncPubB64);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(plaintext))
    );
    const packed = new Uint8Array(iv.length + cipher.length);
    packed.set(iv, 0);
    packed.set(cipher, iv.length);
    return bytesToB64(packed);
  } catch {
    return null;
  }
}

export async function openDmBody(
  sealedB64: string,
  selfEnc: EncryptionIdentity,
  peerEncPubB64: string
): Promise<string | null> {
  try {
    const key = await sharedAesKey(selfEnc.privateKey, peerEncPubB64);
    const packed = b64ToBytes(sealedB64);
    if (packed.length < 13) return null;
    const iv = packed.slice(0, 12);
    const cipher = packed.slice(12);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return td.decode(plain);
  } catch {
    return null;
  }
}
