import * as ed from '@noble/ed25519';
import { canonicalForumPayload, canonicalDmPayload, type ForumEvent, type DirectMessage } from '../protocol';

/** RFC 8410 SPKI prefix for a raw 32-byte Ed25519 public key. */
const ED25519_SPKI_PREFIX = Uint8Array.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

type SigningBackend = 'webcrypto' | 'noble';

export interface SigningIdentity {
  backend: SigningBackend;
  publicKeySpkiB64: string;
  /** Native SubtleCrypto pair when available (Chrome 137+, Firefox 129+, Safari 17+). */
  keyPair?: CryptoKeyPair;
  /** 32-byte secret for @noble/ed25519 when WebCrypto Ed25519 is missing. */
  nobleSecret?: Uint8Array;
}

export interface VerifyKey {
  verify(signature: Uint8Array, data: Uint8Array): Promise<boolean>;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function rawPublicKeyToSpki(raw: Uint8Array): Uint8Array {
  if (raw.length !== 32) throw new Error('Ed25519 public key must be 32 bytes');
  const spki = new Uint8Array(ED25519_SPKI_PREFIX.length + raw.length);
  spki.set(ED25519_SPKI_PREFIX, 0);
  spki.set(raw, ED25519_SPKI_PREFIX.length);
  return spki;
}

function spkiToRawPublicKey(spki: Uint8Array): Uint8Array {
  if (spki.length === 32) return spki;
  if (spki.length >= ED25519_SPKI_PREFIX.length + 32) {
    return spki.subarray(spki.length - 32);
  }
  throw new Error('Unrecognized Ed25519 SPKI encoding');
}

let nativeEd25519: boolean | null = null;

/**
 * Feature-detect SubtleCrypto Ed25519 (not the same as SubtleCrypto itself).
 * @see https://caniuse.com/mdn-api_subtlecrypto_generatekey_ed25519
 */
export async function supportsNativeEd25519(): Promise<boolean> {
  if (nativeEd25519 !== null) return nativeEd25519;
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    nativeEd25519 = false;
    return false;
  }
  try {
    const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
    nativeEd25519 = Boolean(pair?.privateKey && pair?.publicKey);
  } catch {
    nativeEd25519 = false;
  }
  return nativeEd25519;
}

export async function generateSigningIdentity(): Promise<SigningIdentity> {
  if (await supportsNativeEd25519()) {
    const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, [
      'sign',
      'verify',
    ]);
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    return {
      backend: 'webcrypto',
      keyPair,
      publicKeySpkiB64: bytesToBase64(new Uint8Array(spki)),
    };
  }

  const { secretKey, publicKey } = await ed.keygenAsync();
  return {
    backend: 'noble',
    nobleSecret: secretKey,
    publicKeySpkiB64: bytesToBase64(rawPublicKeyToSpki(publicKey)),
  };
}

export async function importVerifyKey(spkiB64: string): Promise<VerifyKey> {
  const spki = base64ToBytes(spkiB64);

  if (await supportsNativeEd25519()) {
    try {
      const key = await crypto.subtle.importKey(
        'spki',
        toArrayBuffer(spki),
        { name: 'Ed25519' },
        false,
        ['verify']
      );
      return {
        verify: async (signature, data) => {
          try {
            return await crypto.subtle.verify(
              { name: 'Ed25519' },
              key,
              toArrayBuffer(signature),
              toArrayBuffer(data)
            );
          } catch {
            return false;
          }
        },
      };
    } catch {
      /* fall through to noble — peers may send raw/SPKI we can still parse */
    }
  }

  const raw = spkiToRawPublicKey(spki);
  return {
    verify: async (signature, data) => {
      try {
        return await ed.verifyAsync(signature, data, raw);
      } catch {
        return false;
      }
    },
  };
}

async function signWithIdentity(
  identity: SigningIdentity,
  payload: Uint8Array
): Promise<Uint8Array> {
  if (identity.backend === 'webcrypto' && identity.keyPair) {
    const signature = await crypto.subtle.sign(
      { name: 'Ed25519' },
      identity.keyPair.privateKey,
      toArrayBuffer(payload)
    );
    return new Uint8Array(signature);
  }
  if (identity.nobleSecret) {
    return ed.signAsync(payload, identity.nobleSecret);
  }
  throw new Error('Signing identity is incomplete');
}

export async function signForumEvent(
  unsigned: Omit<ForumEvent, 'sig'>,
  identity: SigningIdentity
): Promise<ForumEvent> {
  const payload = new TextEncoder().encode(canonicalForumPayload(unsigned));
  const signature = await signWithIdentity(identity, payload);
  return {
    ...unsigned,
    sig: bytesToBase64(signature),
  };
}

export async function verifyForumEvent(
  event: ForumEvent,
  publicKey: VerifyKey
): Promise<boolean> {
  try {
    const { sig, ...rest } = event;
    const payload = new TextEncoder().encode(canonicalForumPayload(rest));
    return await publicKey.verify(base64ToBytes(sig), payload);
  } catch {
    return false;
  }
}

export async function signDirectMessage(
  unsigned: Omit<DirectMessage, 'sig'>,
  identity: SigningIdentity
): Promise<DirectMessage> {
  const payload = new TextEncoder().encode(canonicalDmPayload(unsigned));
  const signature = await signWithIdentity(identity, payload);
  return {
    ...unsigned,
    sig: bytesToBase64(signature),
  };
}

export async function verifyDirectMessage(
  dm: DirectMessage,
  publicKey: VerifyKey
): Promise<boolean> {
  try {
    const { sig, ...rest } = dm;
    const payload = new TextEncoder().encode(canonicalDmPayload(rest));
    return await publicKey.verify(base64ToBytes(sig), payload);
  } catch {
    return false;
  }
}
