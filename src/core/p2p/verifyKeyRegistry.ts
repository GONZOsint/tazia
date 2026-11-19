import { importVerifyKey, type VerifyKey } from '../crypto/messageSigning';
import { TrustStore, type TrustLevel } from '../trust/trustStore';

export interface VerifyKeyRegistryOptions {
  trustStore: TrustStore;
  onKeyChange?: (userId: string, level: TrustLevel) => void;
  onKeysReady?: (userId: string) => void;
}

/**
 * SPKI → VerifyKey cache. Always verifies against TrustStore pinned key;
 * key rotation sets `changed` without silently switching the verify key.
 */
export class VerifyKeyRegistry {
  private readonly verifyKeyCache = new Map<string, VerifyKey>();
  private readonly cachedPinSpki = new Map<string, string>();
  private readonly trustStore: TrustStore;
  private readonly onKeyChange?: (userId: string, level: TrustLevel) => void;
  private readonly onKeysReady?: (userId: string) => void;

  constructor(opts: VerifyKeyRegistryOptions) {
    this.trustStore = opts.trustStore;
    this.onKeyChange = opts.onKeyChange;
    this.onKeysReady = opts.onKeysReady;
  }

  getKnownSpki(userId: string): string | undefined {
    return this.trustStore.get(userId)?.pinnedKeyB64;
  }

  private async loadPinned(userId: string, pinned: string): Promise<VerifyKey | null> {
    if (this.cachedPinSpki.get(userId) === pinned) {
      const cached = this.verifyKeyCache.get(userId);
      if (cached) return cached;
    } else {
      this.verifyKeyCache.delete(userId);
    }

    try {
      const key = await importVerifyKey(pinned);
      this.verifyKeyCache.set(userId, key);
      this.cachedPinSpki.set(userId, pinned);
      this.onKeysReady?.(userId);
      return key;
    } catch {
      return null;
    }
  }

  async observe(
    userId: string,
    spkiB64: string,
    encRawB64?: string
  ): Promise<VerifyKey | null> {
    if (!userId || !spkiB64 || spkiB64.length < 32) return null;

    // Refuse TOFU pin / changed observe if the observed SPKI cannot be imported.
    try {
      await importVerifyKey(spkiB64);
    } catch {
      return null;
    }

    const trustLevel = this.trustStore.observe(userId, spkiB64, encRawB64);
    const pinned = this.trustStore.get(userId)?.pinnedKeyB64;
    if (!pinned) return null;

    if (trustLevel === 'changed') {
      this.onKeyChange?.(userId, trustLevel);
    }

    return this.loadPinned(userId, pinned);
  }

  /** After TrustStore.repin — re-import pinned SPKI. */
  async invalidateAndReload(userId: string): Promise<VerifyKey | null> {
    this.verifyKeyCache.delete(userId);
    this.cachedPinSpki.delete(userId);
    const pinned = this.trustStore.get(userId)?.pinnedKeyB64;
    if (!pinned) return null;
    return this.loadPinned(userId, pinned);
  }

  async get(userId: string): Promise<VerifyKey | null> {
    const pinned = this.trustStore.get(userId)?.pinnedKeyB64;
    if (!pinned) return null;
    return this.loadPinned(userId, pinned);
  }

  clear(): void {
    this.verifyKeyCache.clear();
    this.cachedPinSpki.clear();
  }
}
