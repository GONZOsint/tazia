/**
 * Presence / goodbye attestation for Nostr fallback (TAZEP).
 * Binds claimed userId to sign/enc keys (TOFU first-writer; not Trystero handshake binding).
 */
import {
  importVerifyKey,
  type SigningIdentity,
} from './messageSigning';
import { b64ToBytes, bytesToB64, toArrayBuffer } from './bytes';
import * as ed from '@noble/ed25519';

export function canonicalPresenceAttestPayload(
  roomId: string,
  userId: string,
  signPubKeySpkiB64: string,
  encPubKeyRawB64: string
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(['tazep.presence.v1', roomId, userId, signPubKeySpkiB64, encPubKeyRawB64])
  );
}

export function canonicalGoodbyeAttestPayload(
  roomId: string,
  userId: string,
  signPubKeySpkiB64: string,
  encPubKeyRawB64: string
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(['tazep.goodbye.v1', roomId, userId, signPubKeySpkiB64, encPubKeyRawB64])
  );
}

async function signRaw(identity: SigningIdentity, payload: Uint8Array): Promise<Uint8Array> {
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

async function verifyRaw(
  signPubKeySpkiB64: string,
  attestSigB64: string,
  payload: Uint8Array
): Promise<boolean> {
  try {
    if (!attestSigB64 || attestSigB64.length < 16) return false;
    const key = await importVerifyKey(signPubKeySpkiB64);
    return await key.verify(b64ToBytes(attestSigB64), payload);
  } catch {
    return false;
  }
}

export async function signPresenceAttestation(
  identity: SigningIdentity,
  roomId: string,
  userId: string,
  signPubKeySpkiB64: string,
  encPubKeyRawB64: string
): Promise<string> {
  const payload = canonicalPresenceAttestPayload(
    roomId,
    userId,
    signPubKeySpkiB64,
    encPubKeyRawB64
  );
  const sig = await signRaw(identity, payload);
  return bytesToB64(sig);
}

export async function verifyPresenceAttestation(
  roomId: string,
  userId: string,
  signPubKeySpkiB64: string,
  encPubKeyRawB64: string,
  attestSigB64: string
): Promise<boolean> {
  return verifyRaw(
    signPubKeySpkiB64,
    attestSigB64,
    canonicalPresenceAttestPayload(roomId, userId, signPubKeySpkiB64, encPubKeyRawB64)
  );
}

export async function signGoodbyeAttestation(
  identity: SigningIdentity,
  roomId: string,
  userId: string,
  signPubKeySpkiB64: string,
  encPubKeyRawB64: string
): Promise<string> {
  const payload = canonicalGoodbyeAttestPayload(
    roomId,
    userId,
    signPubKeySpkiB64,
    encPubKeyRawB64
  );
  const sig = await signRaw(identity, payload);
  return bytesToB64(sig);
}

export async function verifyGoodbyeAttestation(
  roomId: string,
  userId: string,
  signPubKeySpkiB64: string,
  encPubKeyRawB64: string,
  attestSigB64: string
): Promise<boolean> {
  return verifyRaw(
    signPubKeySpkiB64,
    attestSigB64,
    canonicalGoodbyeAttestPayload(roomId, userId, signPubKeySpkiB64, encPubKeyRawB64)
  );
}
