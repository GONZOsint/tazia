import { describe, expect, it, beforeEach } from 'vitest';
import { argon2id } from '@noble/hashes/argon2.js';
import { bytesToHex } from '../crypto/bytes';
import { PROTOCOL_VERSION, type DirectMessage } from '../protocol';
import { ARGON2_OWASP } from './argon2Params';
import { resetArgon2InvokeCount, argon2InvokeCount } from './argon2Derive';
import {
  clearRoomCryptoCache,
  decryptJson,
  deriveDmWrapKey,
  deriveSessionMaterial,
  encryptDmWrap,
  encryptJson,
  padPlaintext,
  tryDecryptDmWrapForSelf,
  unpadPlaintext,
} from './roomCrypto';

function sampleDm(from: string, to: string): DirectMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    msgId: 'dmMsgId01abcdefghij',
    fromUserId: from,
    toUserId: to,
    createdAtMs: 1_700_000_000_000,
    body: 'secret whisper',
    bodyCipherB64: 'C'.repeat(32),
    seal: 2,
    sig: 'S'.repeat(64),
  };
}

beforeEach(() => {
  clearRoomCryptoCache();
  resetArgon2InvokeCount();
});

describe('Argon2id OWASP vector', () => {
  it('matches @noble argon2id for fixed password/salt', () => {
    const out = argon2id('correct horse battery staple', '0123456789abcdef', {
      ...ARGON2_OWASP,
    });
    expect(out.length).toBe(32);
    expect(bytesToHex(out)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('deriveSessionMaterial cache', () => {
  it('pays Argon2 once per room+phrase then reuses master for dm-wrap', async () => {
    const roomId = 'zone-cache-01';
    const phrase = 'cache phrase for argon test';
    await deriveSessionMaterial(roomId, phrase);
    const afterSession = argon2InvokeCount;
    expect(afterSession).toBeGreaterThanOrEqual(1);

    await deriveDmWrapKey(roomId, phrase, 'aliceUserId01', 'bobUserId00001');
    await deriveDmWrapKey(roomId, phrase, 'bobUserId00001', 'aliceUserId01');
    expect(argon2InvokeCount).toBe(afterSession);

    await deriveSessionMaterial(roomId, phrase);
    expect(argon2InvokeCount).toBe(afterSession);
  }, 60_000);
});

describe('padPlaintext u32 + Padmé', () => {
  it('round-trips small and >65k payloads', () => {
    const small = new TextEncoder().encode('hi');
    expect(unpadPlaintext(padPlaintext(small))).toEqual(small);

    const big = new Uint8Array(70_000);
    big.fill(7);
    const padded = padPlaintext(big);
    expect(padded.length).toBeGreaterThanOrEqual(70_004);
    expect(unpadPlaintext(padded)).toEqual(big);
  });
});

describe('encryptJson blob 0x04', () => {
  it('round-trips JSON under room key', async () => {
    const roomId = 'zone-json-01';
    const phrase = 'json round trip phrase';
    const { roomKey } = await deriveSessionMaterial(roomId, phrase);
    const payload = { v: 2, t: 'forum', hello: 'plaza' };
    const sealed = await encryptJson(roomKey, payload, roomId);
    const opened = await decryptJson<typeof payload>(roomKey, sealed, roomId);
    expect(opened).toEqual(payload);
  }, 60_000);

  it('rejects wrong room AAD', async () => {
    const phrase = 'aad mismatch phrase';
    const { roomKey } = await deriveSessionMaterial('room-a', phrase);
    const sealed = await encryptJson(roomKey, { ok: true }, 'room-a');
    const opened = await decryptJson(roomKey, sealed, 'room-b');
    expect(opened).toBeNull();
  }, 60_000);
});

describe('dm-wrap pairwise', () => {
  it('round-trips for the intended pair and fails for a third peer', async () => {
    const roomId = 'zone-alpha-01';
    const phrase = 'correct horse battery staple';
    const alice = 'aliceUserId01';
    const bob = 'bobUserId00001';
    const eve = 'eveUserId00001';
    const dm = sampleDm(alice, bob);

    const keyAb = await deriveDmWrapKey(roomId, phrase, alice, bob);
    const keyBa = await deriveDmWrapKey(roomId, phrase, bob, alice);
    const blob = await encryptDmWrap(keyAb, dm, roomId);

    const opened = await tryDecryptDmWrapForSelf(roomId, phrase, bob, [alice, eve], blob);
    expect(opened?.msgId).toBe(dm.msgId);
    expect(opened?.toUserId).toBe(bob);

    const asEve = await tryDecryptDmWrapForSelf(roomId, phrase, eve, [alice, bob], blob);
    expect(asEve).toBeNull();

    const blob2 = await encryptDmWrap(keyBa, dm, roomId);
    const opened2 = await tryDecryptDmWrapForSelf(roomId, phrase, bob, [alice], blob2);
    expect(opened2?.fromUserId).toBe(alice);
  }, 60_000);

  it('hides DM fields from room-layer decrypt of a dm-wrap envelope', async () => {
    const roomId = 'zone-beta-02';
    const phrase = 'phrase for wrap test';
    const alice = 'aliceUserId02';
    const bob = 'bobUserId00002';
    const dm = sampleDm(alice, bob);
    const wrapKey = await deriveDmWrapKey(roomId, phrase, alice, bob);
    const blobB64 = await encryptDmWrap(wrapKey, dm, roomId);
    const { roomKey } = await deriveSessionMaterial(roomId, phrase);
    const outer = await encryptJson(roomKey, { v: 3, t: 'dm-wrap', blobB64 }, roomId);
    const decoded = await decryptJson<{ v: number; t: string; blobB64?: string; dm?: unknown }>(
      roomKey,
      outer,
      roomId
    );
    expect(decoded?.t).toBe('dm-wrap');
    expect(decoded?.dm).toBeUndefined();
    expect(typeof decoded?.blobB64).toBe('string');
    expect(JSON.stringify(decoded)).not.toContain(dm.body);
    expect(JSON.stringify(decoded)).not.toContain(alice);
  }, 60_000);
});
