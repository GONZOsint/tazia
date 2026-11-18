/**
 * TOFU (Trust On First Use) key-pinning trust store.
 *
 * Each peer is tracked by their userId. The first time we see their public key
 * we pin it as "new". The user can verify the safety code out-of-band and
 * promote the peer to "verified". If the key changes we flag them as "changed"
 * (potential MITM).
 */

export type TrustLevel = 'new' | 'trusted' | 'verified' | 'changed';

export interface TrustRecord {
  userId: string;
  /** SPKI base64 of the first-seen signing public key. */
  pinnedKeyB64: string;
  /** Current key if it differs from pinnedKeyB64, else null. */
  currentKeyB64: string | null;
  level: TrustLevel;
  firstSeenMs: number;
  lastSeenMs: number;
}

const EMOJI_POOL = [
  '🐶','🐱','🐻','🦊','🐸','🐵','🐙','🦋','🐝','🐢',
  '🦈','🐬','🦉','🦜','🍎','🍋','🍇','🌻','🌈','⭐',
  '🔥','💎','🎵','🎲','🚀','🛸','⚡','🌊','🍀','🎯',
  '🗝️','🧩','🎨','🪐','❄️','🌙',
];

/**
 * Derive a 4-emoji safety code from two SPKI-b64 public keys.
 * Both sides will produce the same code regardless of who calls it,
 * because we sort the keys lexicographically before hashing.
 */
export async function deriveEmojiSafetyCode(
  keyA_b64: string,
  keyB_b64: string,
): Promise<string> {
  const sorted = [keyA_b64, keyB_b64].sort();
  const input = new TextEncoder().encode(sorted.join('|'));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  const emojis: string[] = [];
  for (let i = 0; i < 4; i++) {
    const idx = hash[i]! % EMOJI_POOL.length;
    emojis.push(EMOJI_POOL[idx]!);
  }
  return emojis.join('');
}

export class TrustStore {
  private readonly records = new Map<string, TrustRecord>();
  private readonly changeListeners = new Set<() => void>();

  /**
   * Observe a peer's public key. Returns the trust level after the observation.
   * - First time: creates a "new" record (TOFU pin).
   * - Same key again: updates lastSeenMs, no level change.
   * - Different key: sets level to "changed" and stores currentKeyB64.
   */
  observe(userId: string, keyB64: string): TrustLevel {
    const now = Date.now();
    const existing = this.records.get(userId);

    if (!existing) {
      this.records.set(userId, {
        userId,
        pinnedKeyB64: keyB64,
        currentKeyB64: null,
        level: 'new',
        firstSeenMs: now,
        lastSeenMs: now,
      });
      this.notify();
      return 'new';
    }

    existing.lastSeenMs = now;

    if (existing.pinnedKeyB64 === keyB64) {
      if (existing.currentKeyB64 !== null) {
        existing.currentKeyB64 = null;
      }
      this.notify();
      return existing.level;
    }

    existing.currentKeyB64 = keyB64;
    existing.level = 'changed';
    this.notify();
    return 'changed';
  }

  /** Mark a peer as verified (after out-of-band emoji code check). */
  verify(userId: string): void {
    const record = this.records.get(userId);
    if (!record) return;
    record.level = 'verified';
    if (record.currentKeyB64) {
      record.pinnedKeyB64 = record.currentKeyB64;
      record.currentKeyB64 = null;
    }
    this.notify();
  }

  /** Accept a key change and re-pin as "new" (user chose to trust the new key). */
  repin(userId: string): void {
    const record = this.records.get(userId);
    if (!record || !record.currentKeyB64) return;
    record.pinnedKeyB64 = record.currentKeyB64;
    record.currentKeyB64 = null;
    record.level = 'new';
    this.notify();
  }

  get(userId: string): TrustRecord | undefined {
    return this.records.get(userId);
  }

  getAll(): ReadonlyMap<string, TrustRecord> {
    return this.records;
  }

  onChange(fn: () => void): () => void {
    this.changeListeners.add(fn);
    return () => { this.changeListeners.delete(fn); };
  }

  private notify(): void {
    for (const fn of this.changeListeners) fn();
  }

  clear(): void {
    this.records.clear();
    this.notify();
  }
}
