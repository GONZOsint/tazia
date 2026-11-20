import { describe, expect, it } from 'vitest';
import { TrustStore } from './trustStore';
import { peerVerifyKeysMatch, pickPeerVerifyKeys } from './pickPeerVerifyKeys';

describe('pickPeerVerifyKeys', () => {
  it('prefers current over presence over pinned', () => {
    const store = new TrustStore();
    store.observe('u1', 'PINNED'.padEnd(64, 'A'), 'ENC0'.padEnd(44, '0'));
    store.observe('u1', 'CURNT'.padEnd(64, 'B'), 'ENC1'.padEnd(44, '1'));
    const keys = pickPeerVerifyKeys(
      store,
      {
        u1: {
          alias: 'x',
          signPubKeySpkiB64: 'PRES'.padEnd(64, 'C'),
          encPubKeyRawB64: 'ENCP'.padEnd(44, '2'),
          avatarSeed: '',
        },
      },
      'u1'
    );
    expect(keys?.keyB64.startsWith('CURNT')).toBe(true);
    expect(keys?.encB64.startsWith('ENC1')).toBe(true);
  });

  it('peerVerifyKeysMatch detects drift', () => {
    const snap = { keyB64: 'a', encB64: 'b' };
    expect(peerVerifyKeysMatch(snap, { keyB64: 'a', encB64: 'b' })).toBe(true);
    expect(peerVerifyKeysMatch(snap, { keyB64: 'a', encB64: 'x' })).toBe(false);
    expect(peerVerifyKeysMatch(snap, null)).toBe(false);
  });
});
