import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForumEvent } from '../protocol';
import { PeerRateLimiter } from './rateLimit';
import { SyncVerify } from './syncVerify';

function makeSv(overrides?: {
  ingestOk?: boolean;
  getEvents?: () => ForumEvent[];
}) {
  const forumIngest = {
    ingest: vi.fn(async () => overrides?.ingestOk !== false),
  };
  const registry = {
    get: vi.fn(async () => null),
  };
  const sv = new SyncVerify({
    roomId: 'room',
    self: { userId: 'self' },
    signing: {} as never,
    registry: registry as never,
    forumIngest: forumIngest as never,
    syncAnswerLimiter: new PeerRateLimiter(),
    getEventsForSync: overrides?.getEvents ?? (() => []),
  });
  return { sv, forumIngest, registry };
}

describe('SyncVerify soft skip', () => {
  it('empty rate-limit answer does not bump rejected count', async () => {
    const { sv } = makeSv();
    const n = await sv.verifyAndIngestSyncPayload({
      events: [],
      eventsDigest: '',
      sig: '',
      fromUserId: '',
      reqId: 'r1',
    });
    expect(n).toBe(0);
    expect(sv.getRejectedSyncCount()).toBe(0);
  });

  it('garbage empty still rejects', async () => {
    const { sv } = makeSv();
    const n = await sv.verifyAndIngestSyncPayload({
      events: [],
      eventsDigest: 'x',
      sig: 'bad',
      fromUserId: 'peer',
      reqId: 'r1',
    });
    expect(n).toBe(0);
    expect(sv.getRejectedSyncCount()).toBe(1);
  });
});

describe('SyncVerify Nostr sync grace', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves before 8s after first good sync-res', async () => {
    const { sv } = makeSv();
    vi.spyOn(sv, 'verifyAndIngestSyncPayload').mockResolvedValue(3);

    let capturedReqId = '';
    const publish = vi.fn(async (env: { reqId: string }) => {
      capturedReqId = env.reqId;
      return true;
    });
    const p = sv.beginNostrSyncRequest(publish);
    expect(capturedReqId).toBeTruthy();
    const reqId = capturedReqId;

    sv.applyNostrSyncResponse(reqId, 'peer', [], 'd', 's');
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();

    // Grace is 600ms — resolve well before absolute 8s cap
    await vi.advanceTimersByTimeAsync(600);
    await expect(p).resolves.toBe(3);
  });
});
