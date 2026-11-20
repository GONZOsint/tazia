import { describe, expect, it } from 'vitest';
import { TrustStore } from './trustStore';

describe('TrustStore enc-only rotation', () => {
  it('stashes currentEnc without changing level, and acceptEncRepin updates pin', () => {
    const store = new TrustStore();
    const sign = 'A'.repeat(64);
    const enc1 = 'B'.repeat(44);
    const enc2 = 'C'.repeat(44);

    expect(store.observe('u1', sign, enc1)).toBe('new');
    expect(store.getPinnedEnc('u1')).toBe(enc1);

    expect(store.observe('u1', sign, enc2)).toBe('new');
    const rec = store.get('u1');
    expect(rec?.level).toBe('new');
    expect(rec?.pinnedEncRawB64).toBe(enc1);
    expect(rec?.currentEncRawB64).toBe(enc2);

    store.acceptEncRepin('u1');
    expect(store.getPinnedEnc('u1')).toBe(enc2);
    expect(store.get('u1')?.currentEncRawB64).toBeNull();
  });

  it('repin is a no-op for enc-only pending (no competing sign)', () => {
    const store = new TrustStore();
    const sign = 'D'.repeat(64);
    store.observe('u2', sign, 'E'.repeat(44));
    store.observe('u2', sign, 'F'.repeat(44));
    store.repin('u2');
    expect(store.getPinnedEnc('u2')).toBe('E'.repeat(44));
    expect(store.get('u2')?.currentEncRawB64).toBe('F'.repeat(44));
  });
});

describe('TrustStore markVerified vs repin on changed', () => {
  it('markVerified is a no-op when level is changed', () => {
    const store = new TrustStore();
    const sign1 = 'G'.repeat(64);
    const sign2 = 'H'.repeat(64);
    store.observe('u3', sign1, 'I'.repeat(44));
    store.observe('u3', sign2, 'J'.repeat(44));
    expect(store.get('u3')?.level).toBe('changed');
    store.markVerified('u3');
    expect(store.get('u3')?.level).toBe('changed');
    expect(store.get('u3')?.pinnedKeyB64).toBe(sign1);
  });

  it('repin after changed promotes to trusted on the new key', () => {
    const store = new TrustStore();
    const sign1 = 'K'.repeat(64);
    const sign2 = 'L'.repeat(64);
    const enc2 = 'M'.repeat(44);
    store.observe('u4', sign1, 'N'.repeat(44));
    store.observe('u4', sign2, enc2);
    store.repin('u4');
    expect(store.get('u4')?.level).toBe('trusted');
    expect(store.get('u4')?.pinnedKeyB64).toBe(sign2);
    expect(store.getPinnedEnc('u4')).toBe(enc2);
    expect(store.get('u4')?.currentKeyB64).toBeNull();
  });
});

