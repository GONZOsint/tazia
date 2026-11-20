import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, type DirectMessage } from '../protocol';
import {
  decryptJson,
  deriveDmWrapKey,
  deriveSessionMaterial,
  encryptDmWrap,
  encryptJson,
  tryDecryptDmWrapForSelf,
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

    // Order-independent pair key.
    const blob2 = await encryptDmWrap(keyBa, dm, roomId);
    const opened2 = await tryDecryptDmWrapForSelf(roomId, phrase, bob, [alice], blob2);
    expect(opened2?.fromUserId).toBe(alice);
  });

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
  });
});
