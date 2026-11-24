/**
 * Padmé length padding (Nikitin et al., PURBs / PETS).
 * Caps overhead at ~12% while collapsing observable sizes to O(log log M) buckets.
 */

/** Next Padmé-allowed length ≥ L. For L < 2 returns L unchanged. */
export function padmeLength(L: number): number {
  if (!Number.isFinite(L) || L < 0) throw new Error('padme: bad length');
  const n = Math.floor(L);
  if (n < 2) return n;
  const E = Math.floor(Math.log2(n));
  const S = Math.floor(Math.log2(E)) + 1;
  const z = E - S;
  if (z <= 0) return n;
  const mask = (1 << z) - 1;
  return (n + mask) & ~mask;
}
