import { describe, expect, it } from 'vitest';
import { argon2idDerive, resetArgon2InvokeCount, argon2InvokeCount } from './argon2Derive';

describe('argon2idDerive resilience', () => {
  it('returns 32-byte master when Worker is unavailable (main-thread fallback)', async () => {
    resetArgon2InvokeCount();
    const master = await argon2idDerive('test-passphrase', 'tazep/v3/room:salt');
    expect(master).toBeInstanceOf(Uint8Array);
    expect(master.length).toBe(32);
    expect(argon2InvokeCount).toBeGreaterThanOrEqual(1);
  });
});
