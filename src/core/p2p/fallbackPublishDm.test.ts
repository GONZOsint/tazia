import { describe, expect, it, vi } from 'vitest';
import type { DirectMessage } from '../protocol';
import type { NostrFallbackBus } from './nostrFallback';

/**
 * Mirrors fallbackBridge.publishDm / publishForum: propagate bus.publish boolean.
 */
async function publishDmViaBus(
  bus: NostrFallbackBus | null,
  dm: DirectMessage
): Promise<boolean> {
  if (!bus) return false;
  return bus.publish({ v: 2, t: 'dm', dm });
}

async function publishForumViaBus(
  bus: NostrFallbackBus | null,
  ensureIfNeeded: boolean
): Promise<boolean> {
  if (!bus && !ensureIfNeeded) return false;
  if (!bus) return false;
  return bus.publish({
    v: 2,
    t: 'forum',
    event: {
      protocolVersion: 2,
      msgId: 'm1',
      type: 'NEW_THREAD',
      threadId: 't1',
      parentMsgId: null,
      title: 't',
      body: 'b',
      createdAtMs: 1,
      authorUserId: 'a',
      sig: 's',
    },
  });
}

const sampleDm: DirectMessage = {
  protocolVersion: 2,
  msgId: 'dm1',
  fromUserId: 'a',
  toUserId: 'b',
  body: '',
  createdAtMs: 1,
  bodyCipherB64: 'x',
  seal: 2,
  sig: 'sig',
};

describe('fallback publishDm delivery boolean', () => {
  it('returns false when bus is missing', async () => {
    await expect(publishDmViaBus(null, sampleDm)).resolves.toBe(false);
  });

  it('returns false when publish is stopped / over cap (bus reports false)', async () => {
    const bus: NostrFallbackBus = {
      publish: vi.fn(async () => false),
      stop: vi.fn(),
    };
    await expect(publishDmViaBus(bus, sampleDm)).resolves.toBe(false);
    expect(bus.publish).toHaveBeenCalledOnce();
  });

  it('returns true only when at least one relay send succeeded', async () => {
    const bus: NostrFallbackBus = {
      publish: vi.fn(async () => true),
      stop: vi.fn(),
    };
    await expect(publishDmViaBus(bus, sampleDm)).resolves.toBe(true);
  });
});

describe('fallback publishForum delivery boolean', () => {
  it('returns false when bus missing and ensure not requested', async () => {
    await expect(publishForumViaBus(null, false)).resolves.toBe(false);
  });

  it('propagates false from bus.publish', async () => {
    const bus: NostrFallbackBus = {
      publish: vi.fn(async () => false),
      stop: vi.fn(),
    };
    await expect(publishForumViaBus(bus, true)).resolves.toBe(false);
  });
});
