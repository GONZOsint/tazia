import { describe, expect, it } from 'vitest';
import { padmeLength } from './padme';

describe('padmeLength', () => {
  it('leaves L < 2 unchanged', () => {
    expect(padmeLength(0)).toBe(0);
    expect(padmeLength(1)).toBe(1);
  });

  it('rounds up to a Padmé-allowed length', () => {
    expect(padmeLength(2)).toBeGreaterThanOrEqual(2);
    expect(padmeLength(100)).toBeGreaterThanOrEqual(100);
    expect(padmeLength(1000)).toBeGreaterThanOrEqual(1000);
  });

  it('is idempotent on its own outputs', () => {
    for (const L of [2, 7, 64, 255, 1000, 50_000, 200_000]) {
      const p = padmeLength(L);
      expect(padmeLength(p)).toBe(p);
    }
  });

  it('keeps overhead under ~12% for mid sizes', () => {
    for (const L of [100, 1000, 10_000, 100_000]) {
      const p = padmeLength(L);
      expect((p - L) / L).toBeLessThanOrEqual(0.13);
    }
  });
});
