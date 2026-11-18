import { canonicalForumPayload, type ForumEvent } from '../protocol';

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

export interface SigningIdentity {
  keyPair: CryptoKeyPair;
  publicKeySpkiB64: string;
}

export async function generateSigningIdentity(): Promise<SigningIdentity> {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, [
    'sign',
    'verify',
  ]);
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  return {
    keyPair,
    publicKeySpkiB64: bytesToBase64(new Uint8Array(spki)),
  };
}

export async function importVerifyKey(spkiB64: string): Promise<CryptoKey> {
  const spki = base64ToBytes(spkiB64);
  return crypto.subtle.importKey(
    'spki',
    spki.buffer.slice(spki.byteOffset, spki.byteOffset + spki.byteLength) as ArrayBuffer,
    { name: 'Ed25519' },
    false,
    ['verify']
  );
}

export async function signForumEvent(
  unsigned: Omit<ForumEvent, 'sig'>,
  privateKey: CryptoKey
): Promise<ForumEvent> {
  const payload = new TextEncoder().encode(canonicalForumPayload(unsigned));
  const signature = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, payload);
  return {
    ...unsigned,
    sig: bytesToBase64(new Uint8Array(signature)),
  };
}

export async function verifyForumEvent(
  event: ForumEvent,
  publicKey: CryptoKey
): Promise<boolean> {
  try {
    const { sig, ...rest } = event;
    const payload = new TextEncoder().encode(canonicalForumPayload(rest));
    const signature = base64ToBytes(sig);
    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      publicKey,
      signature.buffer.slice(
        signature.byteOffset,
        signature.byteOffset + signature.byteLength
      ) as ArrayBuffer,
      payload
    );
  } catch {
    return false;
  }
}
