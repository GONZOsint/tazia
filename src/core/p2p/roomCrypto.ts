/** Room-phrase AES-GCM helpers for the Nostr data-plane fallback (v3 KDF + v4 blob). */

import { b64ToBytes, bytesToB64, bytesToHex, toArrayBuffer } from '../crypto/bytes';
import type { DirectMessage } from '../protocol';
import { argon2idDerive } from './argon2Derive';
import { padmeLength } from './padme';

const te = new TextEncoder();
const td = new TextDecoder();

/** Wire blob: version + IV(12) + ciphertext. v4 = u32be pad + Padmé + AAD v4. */
const BLOB_VERSION = 0x04;
/** Inner DM-wrap blob (pairwise). */
const DM_WRAP_BLOB_VERSION = 0x02;

type MasterCacheEntry = {
  master: ArrayBuffer;
  roomKey?: CryptoKey;
  topicId?: string;
};

const masterCache = new Map<string, MasterCacheEntry>();

function cacheKey(roomId: string, phrase: string): string {
  return `${roomId}\0${phrase}`;
}

/** Drop cached Argon2/HKDF material for one room or all rooms. */
export function clearRoomCryptoCache(roomId?: string): void {
  if (!roomId) {
    masterCache.clear();
    return;
  }
  const prefix = `${roomId}\0`;
  for (const k of masterCache.keys()) {
    if (k.startsWith(prefix)) masterCache.delete(k);
  }
}

async function deriveMasterBits(roomId: string, password: string): Promise<ArrayBuffer> {
  const key = cacheKey(roomId, password);
  const hit = masterCache.get(key);
  if (hit) return hit.master;

  const salt = `tazep.fallback.v3:${roomId}`;
  const masterBytes = await argon2idDerive(password, salt);
  const master = toArrayBuffer(masterBytes);
  masterCache.set(key, { master });
  return master;
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

/** Unified session material (room AES key + Nostr topic id). One Argon2id, then dual HKDF. */
export async function deriveSessionMaterial(
  roomId: string,
  phrase: string
): Promise<{ roomKey: CryptoKey; topicId: string }> {
  const key = cacheKey(roomId, phrase);
  const hit = masterCache.get(key);
  if (hit?.roomKey && hit.topicId) {
    return { roomKey: hit.roomKey, topicId: hit.topicId };
  }

  const master = await deriveMasterBits(roomId, phrase);
  const [keyBits, topicBits] = await Promise.all([
    hkdfExpand(master, 'tazep/v3/room-key', 256),
    hkdfExpand(master, 'tazep/v3/topic', 256),
  ]);
  const roomKey = await crypto.subtle.importKey(
    'raw',
    keyBits,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  const topicId = bytesToHex(new Uint8Array(topicBits)).slice(0, 32);
  const entry = masterCache.get(key) ?? { master };
  entry.roomKey = roomKey;
  entry.topicId = topicId;
  entry.master = master;
  masterCache.set(key, entry);
  return { roomKey, topicId };
}

/** Pairwise AES key so co-members cannot read Susurro metadata after room decrypt. */
export async function deriveDmWrapKey(
  roomId: string,
  phrase: string,
  userA: string,
  userB: string
): Promise<CryptoKey> {
  const [left, right] = [userA, userB].sort((a, b) => a.localeCompare(b, 'en'));
  const master = await deriveMasterBits(roomId, phrase);
  const keyBits = await hkdfExpand(master, `tazep/v3/dm-wrap:${left}:${right}`, 256);
  return crypto.subtle.importKey(
    'raw',
    keyBits,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function dmWrapAad(roomId: string): Uint8Array {
  return te.encode(`tazep.dm-wrap.aad.v2:${roomId}`);
}

export async function encryptDmWrap(
  key: CryptoKey,
  dm: DirectMessage,
  roomId: string
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = padPlaintext(te.encode(JSON.stringify(dm)));
  const aad = dmWrapAad(roomId);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: toArrayBuffer(aad) },
      key,
      toArrayBuffer(plain)
    )
  );
  const packed = new Uint8Array(1 + iv.length + cipher.length);
  packed[0] = DM_WRAP_BLOB_VERSION;
  packed.set(iv, 1);
  packed.set(cipher, 1 + iv.length);
  return bytesToB64(packed);
}

export async function decryptDmWrap(
  key: CryptoKey,
  blobB64: string,
  roomId: string
): Promise<DirectMessage | null> {
  try {
    const packed = b64ToBytes(blobB64);
    if (packed.length < 14 || packed[0] !== DM_WRAP_BLOB_VERSION) return null;
    const iv = packed.slice(1, 13);
    const cipher = packed.slice(13);
    const aad = dmWrapAad(roomId);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: toArrayBuffer(aad) },
        key,
        toArrayBuffer(cipher)
      )
    );
    const dm = JSON.parse(td.decode(unpadPlaintext(plain))) as DirectMessage;
    if (!dm || typeof dm !== 'object') return null;
    return dm;
  } catch {
    return null;
  }
}

/** Try pairwise unwrap against candidate peers (no from/to on the wire after room decrypt). */
export async function tryDecryptDmWrapForSelf(
  roomId: string,
  phrase: string,
  selfUserId: string,
  peerIds: string[],
  blobB64: string
): Promise<DirectMessage | null> {
  for (const peerId of peerIds) {
    if (!peerId || peerId === selfUserId) continue;
    const key = await deriveDmWrapKey(roomId, phrase, selfUserId, peerId);
    const dm = await decryptDmWrap(key, blobB64, roomId);
    if (dm && dm.toUserId === selfUserId) return dm;
  }
  return null;
}

/** u32be length + plaintext + zero pad to Padmé(4 + len). */
export function padPlaintext(plain: Uint8Array): Uint8Array {
  const len = plain.length;
  const headerAndBody = 4 + len;
  const total = padmeLength(headerAndBody);
  if (total < headerAndBody) throw new Error('padme undersized');
  const out = new Uint8Array(total);
  out[0] = (len >>> 24) & 0xff;
  out[1] = (len >>> 16) & 0xff;
  out[2] = (len >>> 8) & 0xff;
  out[3] = len & 0xff;
  out.set(plain, 4);
  return out;
}

export function unpadPlaintext(padded: Uint8Array): Uint8Array {
  if (padded.length < 4) throw new Error('pad too short');
  const len =
    ((padded[0]! << 24) | (padded[1]! << 16) | (padded[2]! << 8) | padded[3]!) >>> 0;
  if (len + 4 > padded.length) throw new Error('bad pad length');
  return padded.subarray(4, 4 + len);
}

function aadBytes(roomId: string): Uint8Array {
  return te.encode(`tazep.fallback.aad.v4:${roomId}`);
}

export async function encryptJson(
  key: CryptoKey,
  value: unknown,
  roomId: string
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = padPlaintext(te.encode(JSON.stringify(value)));
  const aad = aadBytes(roomId);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: toArrayBuffer(aad) },
      key,
      toArrayBuffer(plain)
    )
  );
  const packed = new Uint8Array(1 + iv.length + cipher.length);
  packed[0] = BLOB_VERSION;
  packed.set(iv, 1);
  packed.set(cipher, 1 + iv.length);
  return bytesToB64(packed);
}

export async function decryptJson<T>(
  key: CryptoKey,
  payloadB64: string,
  roomId: string
): Promise<T | null> {
  try {
    const packed = b64ToBytes(payloadB64);
    if (packed.length < 14 || packed[0] !== BLOB_VERSION) return null;
    const iv = packed.slice(1, 13);
    const cipher = packed.slice(13);
    const aad = aadBytes(roomId);
    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: toArrayBuffer(aad) },
        key,
        toArrayBuffer(cipher)
      )
    );
    return JSON.parse(td.decode(unpadPlaintext(plain))) as T;
  } catch {
    return null;
  }
}
