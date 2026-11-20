import { describe, expect, it } from 'vitest';
import { applyTrustSasConfirm, isEncOnlyPending } from './trustResolve';
import { TrustStore } from './trustStore';

describe('applyTrustSasConfirm', () => {
  it('prefers enc-repin when changed with only enc pending', () => {
    const store = new TrustStore();
    const sign = 'A'.repeat(64);
    store.observe('u1', sign, 'B'.repeat(44));
    // Flap to changed then settle sign back while enc rotates.
    store.observe('u1', 'C'.repeat(64), 'D'.repeat(44));
    // Simulate settled pin: manually clear currentKey but leave changed + enc pending
    // by re-observing original sign with new enc.
    store.observe('u1', sign, 'E'.repeat(44));
    const rec = store.get('u1')!;
    // After re-observe same sign: level may be changed still with enc pending
    expect(isEncOnlyPending(rec) || rec.currentEncRawB64).toBeTruthy();

    // Force the enc-only+changed shape the bug targeted.
    rec.level = 'changed';
    rec.currentKeyB64 = null;
    rec.currentEncRawB64 = 'E'.repeat(44);
    rec.pinnedEncRawB64 = 'B'.repeat(44);

    const result = applyTrustSasConfirm(store, 'u1');
    expect(result).toBe('enc-repin');
    expect(store.getPinnedEnc('u1')).toBe('E'.repeat(44));
    expect(store.get('u1')?.level).toBe('trusted');
    expect(store.get('u1')?.currentEncRawB64).toBeNull();
  });

  it('repins when a competing sign key is pending', () => {
    const store = new TrustStore();
    store.observe('u2', 'F'.repeat(64), 'G'.repeat(44));
    store.observe('u2', 'H'.repeat(64), 'I'.repeat(44));
    expect(applyTrustSasConfirm(store, 'u2')).toBe('repin');
    expect(store.get('u2')?.pinnedKeyB64).toBe('H'.repeat(64));
    expect(store.get('u2')?.level).toBe('trusted');
  });

  it('verifies a new peer with no pending keys', () => {
    const store = new TrustStore();
    store.observe('u3', 'J'.repeat(64), 'K'.repeat(44));
    expect(applyTrustSasConfirm(store, 'u3')).toBe('verified');
    expect(store.get('u3')?.level).toBe('verified');
  });

  it('verifies a new peer with enc-only pending in one SAS', () => {
    const store = new TrustStore();
    const sign = 'L'.repeat(64);
    store.observe('u4', sign, 'M'.repeat(44));
    store.observe('u4', sign, 'N'.repeat(44));
    const rec = store.get('u4')!;
    expect(rec.level).toBe('new');
    expect(isEncOnlyPending(rec)).toBe(true);

    expect(applyTrustSasConfirm(store, 'u4')).toBe('verified');
    expect(store.get('u4')?.level).toBe('verified');
    expect(store.getPinnedEnc('u4')).toBe('N'.repeat(44));
    expect(store.get('u4')?.currentEncRawB64).toBeNull();
  });

  it('returns noop for unknown user', () => {
    const store = new TrustStore();
    expect(applyTrustSasConfirm(store, 'missing')).toBe('noop');
  });
});
