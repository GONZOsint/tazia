/** Pairwise Susurro sealing: X25519 ECDH + AES-GCM with room-bound AAD (v2). */

import { b64ToBytes, bytesToB64, toArrayBuffer } from './bytes';

const te = new TextEncoder();
const td = new TextDecoder();

export interface EncryptionIdentity {
  publicKeyRawB64: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
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

/** Best-effort wipe of non-extractable key material references. */
export function wipeEncryptionIdentity(identity: EncryptionIdentity | null): void {
  if (!identity) return;
  // CryptoKey is non-extractable; drop references so GC can reclaim.
  (identity as { privateKey?: CryptoKey | null }).privateKey = null;
  (identity as { publicKey?: CryptoKey | null }).publicKey = null;
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
  peerPublicRawB64: string,
  roomId: string
): Promise<CryptoKey> {
  const peerPub = await importPeerPublic(peerPublicRawB64);
  const bits = await crypto.subtle.deriveBits(
    { name: 'X25519', public: peerPub } as unknown as AlgorithmIdentifier,
    privateKey,
    256
  );
  const hkdfKey = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: te.encode(`tazia.app/dm-v2:${roomId}`),
      info: te.encode('tazia.app/dm-v2'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function dmAad(roomId: string, fromUserId: string, toUserId: string, msgId: string): Uint8Array {
  return te.encode(`tazia.dm.aad.v2:${roomId}|${fromUserId}|${toUserId}|${msgId}`);
}

export interface SealDmParams {
  plaintext: string;
  selfEnc: EncryptionIdentity;
  peerEncPubB64: string;
  roomId: string;
  fromUserId: string;
  toUserId: string;
  msgId: string;
}

/** Returns base64(iv||ciphertext) or null if sealing unavailable. */
export async function sealDmBody(params: SealDmParams): Promise<string | null> {
  try {
    const key = await sharedAesKey(params.selfEnc.privateKey, params.peerEncPubB64, params.roomId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = dmAad(params.roomId, params.fromUserId, params.toUserId, params.msgId);
    const cipher = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: toArrayBuffer(aad) },
        key,
        te.encode(params.plaintext)
      )
    );
    const packed = new Uint8Array(iv.length + cipher.length);
    packed.set(iv, 0);
    packed.set(cipher, iv.length);
    return bytesToB64(packed);
  } catch {
    return null;
  }
}

export interface OpenDmParams {
  sealedB64: string;
  selfEnc: EncryptionIdentity;
  peerEncPubB64: string;
  roomId: string;
  fromUserId: string;
  toUserId: string;
  msgId: string;
}

export async function openDmBody(params: OpenDmParams): Promise<string | null> {
  try {
    const key = await sharedAesKey(params.selfEnc.privateKey, params.peerEncPubB64, params.roomId);
    const packed = b64ToBytes(params.sealedB64);
    if (packed.length < 13) return null;
    const iv = packed.slice(0, 12);
    const cipher = packed.slice(12);
    const aad = dmAad(params.roomId, params.fromUserId, params.toUserId, params.msgId);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: toArrayBuffer(aad) },
      key,
      toArrayBuffer(cipher)
    );
    return td.decode(plain);
  } catch {
    return null;
  }
}
