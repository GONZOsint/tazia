import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, type ForumEvent } from '../protocol';
import {
  digestSyncEvents,
  generateSigningIdentity,
  importVerifyKey,
  signSyncRes,
  verifySyncRes,
} from './messageSigning';

function sampleEvent(msgId: string): ForumEvent {
  return {
    protocolVersion: PROTOCOL_VERSION,
    msgId,
    type: 'NEW_THREAD',
    threadId: msgId,
    parentMsgId: null,
    title: 't',
    body: 'hello',
    createdAtMs: 1_700_000_000_000,
    authorUserId: 'author01',
    sig: 'C'.repeat(64),
  };
}

describe('sync-res digest + verify', () => {
  it('accepts a correctly signed digest and rejects digest mismatch / bad sig', async () => {
    const identity = await generateSigningIdentity();
    const verifyKey = await importVerifyKey(identity.publicKeySpkiB64);
    const events = [sampleEvent('msgId001abcdefgh')];
    const digest = await digestSyncEvents(events);
    const sig = await signSyncRes(
      identity,
      'room-a',
      'webrtc-sync',
      'from-user-1',
      'to-user-1',
      digest
    );

    await expect(
      verifySyncRes(verifyKey, 'room-a', 'webrtc-sync', 'from-user-1', 'to-user-1', digest, sig)
    ).resolves.toBe(true);

    const wrongDigest = await digestSyncEvents([sampleEvent('msgId002abcdefgh')]);
    await expect(
      verifySyncRes(
        verifyKey,
        'room-a',
        'webrtc-sync',
        'from-user-1',
        'to-user-1',
        wrongDigest,
        sig
      )
    ).resolves.toBe(false);

    await expect(
      verifySyncRes(
        verifyKey,
        'room-a',
        'webrtc-sync',
        'from-user-1',
        'to-user-1',
        digest,
        'D'.repeat(64)
      )
    ).resolves.toBe(false);
  });
});
