import type { TrustStore } from './trustStore';

export type TrustSasConfirmResult = 'repin' | 'enc-repin' | 'verified' | 'noop';

/** True when only enc is pending under the same (or absent competing) sign pin. */
export function isEncOnlyPending(rec: {
  currentEncRawB64: string | null;
  currentKeyB64: string | null;
  pinnedKeyB64: string;
} | null | undefined): boolean {
  if (!rec?.currentEncRawB64) return false;
  return !rec.currentKeyB64 || rec.currentKeyB64 === rec.pinnedKeyB64;
}

/**
 * Apply post-SAS trust mutation. Enc-only before sign repin (Presence must match banner).
 * Returns what changed so callers dismiss alerts only when not `noop`.
 */
export function applyTrustSasConfirm(store: TrustStore, userId: string): TrustSasConfirmResult {
  const before = store.get(userId);
  if (!before) return 'noop';

  if (isEncOnlyPending(before)) {
    const levelBefore = before.level;
    store.acceptEncRepin(userId);
    const afterEnc = store.get(userId);
    if (!afterEnc || afterEnc.currentEncRawB64) return 'noop';
    // First-time / trusted SAS: accept enc rotation and promote to verified in one confirm.
    if (levelBefore === 'new' || levelBefore === 'trusted') {
      store.markVerified(userId);
      const after = store.get(userId);
      if (!after || after.level !== 'verified') return 'noop';
      return 'verified';
    }
    return 'enc-repin';
  }

  if (before.currentKeyB64) {
    store.repin(userId);
    const after = store.get(userId);
    if (!after || after.currentKeyB64) return 'noop';
    return 'repin';
  }

  const levelBefore = before.level;
  store.markVerified(userId);
  const after = store.get(userId);
  if (!after || after.level === levelBefore || after.level !== 'verified') return 'noop';
  return 'verified';
}
