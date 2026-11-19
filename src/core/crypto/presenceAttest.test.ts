import { describe, expect, it } from 'vitest';
import { LIVE_CLOCK_SKEW_MS } from '../protocol';
import { PresenceKeys } from '../p2p/presenceKeys';
import { isAttestAtMsFresh } from './presenceAttest';

describe('isAttestAtMsFresh', () => {
  it('accepts within live skew and rejects outside', () => {
    const now = 1_700_000_000_000;
    expect(isAttestAtMsFresh(now, now)).toBe(true);
    expect(isAttestAtMsFresh(now - LIVE_CLOCK_SKEW_MS, now)).toBe(true);
    expect(isAttestAtMsFresh(now - LIVE_CLOCK_SKEW_MS - 1, now)).toBe(false);
  });
});

describe('PresenceKeys.acceptAttestAtMs', () => {
  it('requires strictly increasing atMs per userId', () => {
    const keys = new PresenceKeys({
      trustStore: null as never,
      registry: null as never,
      knownEncPubKeys: new Map(),
      dmIngest: null as never,
    });
    expect(keys.acceptAttestAtMs('alice', 100)).toBe(true);
    expect(keys.acceptAttestAtMs('alice', 100)).toBe(false);
    expect(keys.acceptAttestAtMs('alice', 99)).toBe(false);
    expect(keys.acceptAttestAtMs('alice', 101)).toBe(true);
    expect(keys.acceptAttestAtMs('bob', 50)).toBe(true);
  });
});
