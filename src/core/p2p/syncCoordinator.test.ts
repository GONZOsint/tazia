import { describe, expect, it } from 'vitest';
import { MAX_SYNC_MESSAGES, PROTOCOL_VERSION, type ForumEvent } from '../protocol';
import { clampSyncEvents } from './syncCoordinator';

function fakeEvent(i: number): ForumEvent {
  return {
    protocolVersion: PROTOCOL_VERSION,
    msgId: `m${i}`,
    type: 'NEW_THREAD',
    threadId: `t${i}`,
    parentMsgId: null,
    title: `t${i}`,
    body: `b${i}`,
    createdAtMs: i,
    authorUserId: 'u',
    sig: 's',
  };
}

describe('clampSyncEvents', () => {
  it('keeps the newest MAX_SYNC_MESSAGES (same window as snapshotForSync)', () => {
    const n = MAX_SYNC_MESSAGES + 25;
    const events = Array.from({ length: n }, (_, i) => fakeEvent(i));
    const clamped = clampSyncEvents(events);
    expect(clamped).toHaveLength(MAX_SYNC_MESSAGES);
    expect(clamped[0]?.msgId).toBe(`m${n - MAX_SYNC_MESSAGES}`);
    expect(clamped[clamped.length - 1]?.msgId).toBe(`m${n - 1}`);
  });
});
