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

/** 256 distinct symbols → 8 bits each; 6 symbols ≈ 48 bits of SAS. Keep unique. */
const EMOJI_POOL = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
  '🐜', '🦟', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡',
  '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪',
  '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩',
  '🦮', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥',
  '🐁', '🐀', '🐿', '🦔', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑',
  '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🫑', '🌽', '🥕', '🫒', '🧄',
  '🧅', '🥔', '🍠', '🫘', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓',
  '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗',
  '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥',
  '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿',
  '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻',
  '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽', '🥣', '🥡', '🥢', '🧂', '🔥',
  '💧', '🌊', '⭐', '🌟', '✨', '⚡', '☀️', '🌤', '⛅', '🌦', '☁', '🌧', '⛈', '🌩', '❄', '☃',
  '⛄', '🌬', '💨', '🌪', '🌫', '🌈', '☂️', '☔', '🌙', '🪐', '🌋', '💥', '☄️', '🌍', '🌎', '🌏',
];

export const SAS_EMOJI_COUNT = 6;

/**
 * Derive a 6-emoji safety code from two SPKI-b64 keys + roomId (channel binding).
 * Order-independent: keys are sorted lexicographically before hashing.
 */
export async function deriveEmojiSafetyCode(
  keyA_b64: string,
  keyB_b64: string,
  roomId = ''
): Promise<string> {
  const sorted = [keyA_b64, keyB_b64].sort();
  const input = new TextEncoder().encode(`${sorted.join('|')}|${roomId}`);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  const emojis: string[] = [];
  for (let i = 0; i < SAS_EMOJI_COUNT; i++) {
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
      this.emitChange();
      return 'new';
    }

    existing.lastSeenMs = now;
    if (existing.pinnedKeyB64 === keyB64) {
      // Pinned key reappeared — clear competing current key but keep `changed`
      // until explicit repin() / re-SAS (no silent auto-heal to trusted).
      if (existing.currentKeyB64) {
        existing.currentKeyB64 = null;
        this.emitChange();
      }
      return existing.level;
    }

    existing.currentKeyB64 = keyB64;
    existing.level = 'changed';
    this.emitChange();
    return 'changed';
  }

  get(userId: string): TrustRecord | undefined {
    return this.records.get(userId);
  }

  getLevel(userId: string): TrustLevel | null {
    return this.records.get(userId)?.level ?? null;
  }

  /** Promote a "new" or "trusted" peer to "verified" after OOB emoji check. */
  markVerified(userId: string): void {
    const rec = this.records.get(userId);
    if (!rec) return;
    if (rec.level === 'changed') return;
    rec.level = 'verified';
    this.emitChange();
  }

  /** Alias used by UI. */
  verify(userId: string): void {
    this.markVerified(userId);
  }

  /** Accept a key change: re-pin to the new key. */
  repin(userId: string): void {
    const rec = this.records.get(userId);
    if (!rec || !rec.currentKeyB64) return;
    rec.pinnedKeyB64 = rec.currentKeyB64;
    rec.currentKeyB64 = null;
    rec.level = 'trusted';
    this.emitChange();
  }

  clear(): void {
    this.records.clear();
    this.emitChange();
  }

  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private emitChange(): void {
    for (const l of this.changeListeners) l();
  }
}
