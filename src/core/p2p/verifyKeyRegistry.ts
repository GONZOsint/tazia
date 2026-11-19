import { importVerifyKey, type VerifyKey } from '../crypto/messageSigning';
import { TrustStore, type TrustLevel } from '../trust/trustStore';

export interface VerifyKeyRegistryOptions {
  trustStore: TrustStore;
  onKeyChange?: (userId: string, level: TrustLevel) => void;
  onKeysReady?: (userId: string) => void;
}

/**
 * SPKI → VerifyKey cache with invalidation on key rotation / repin.
 */
export class VerifyKeyRegistry {
  private readonly verifyKeyCache = new Map<string, VerifyKey>();
  private readonly knownPubKeys = new Map<string, string>();
  private readonly trustStore: TrustStore;
  private readonly onKeyChange?: (userId: string, level: TrustLevel) => void;
  private readonly onKeysReady?: (userId: string) => void;

  constructor(opts: VerifyKeyRegistryOptions) {
    this.trustStore = opts.trustStore;
    this.onKeyChange = opts.onKeyChange;
    this.onKeysReady = opts.onKeysReady;
  }

  getKnownSpki(userId: string): string | undefined {
    return this.knownPubKeys.get(userId);
  }

  async observe(userId: string, spkiB64: string): Promise<VerifyKey | null> {
    if (!userId || !spkiB64 || spkiB64.length < 32) return null;

    const prev = this.knownPubKeys.get(userId);
    this.knownPubKeys.set(userId, spkiB64);

    const trustLevel = this.trustStore.observe(userId, spkiB64);
    if (trustLevel === 'changed') {
      this.onKeyChange?.(userId, trustLevel);
    }

    if (prev === spkiB64) {
      const existing = this.verifyKeyCache.get(userId);
      if (existing) {
        this.onKeysReady?.(userId);
        return existing;
      }
    } else if (prev) {
      // Key rotated or first observe after change — drop stale VerifyKey.
      this.verifyKeyCache.delete(userId);
    }

    try {
      const key = await importVerifyKey(spkiB64);
      this.verifyKeyCache.set(userId, key);
      this.onKeysReady?.(userId);
      return key;
    } catch {
      return null;
    }
  }

  /** After TrustStore.repin — re-import current SPKI. */
  async invalidateAndReload(userId: string): Promise<VerifyKey | null> {
    this.verifyKeyCache.delete(userId);
    const spki = this.knownPubKeys.get(userId);
    if (!spki) return null;
    return this.observe(userId, spki);
  }

  async get(userId: string): Promise<VerifyKey | null> {
    const cached = this.verifyKeyCache.get(userId);
    if (cached) return cached;
    const spki = this.knownPubKeys.get(userId);
    if (!spki) return null;
    return this.observe(userId, spki);
  }

  clear(): void {
    this.verifyKeyCache.clear();
    this.knownPubKeys.clear();
  }
}
