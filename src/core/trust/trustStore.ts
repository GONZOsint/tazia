/**
 * TOFU (Trust On First Use) key-pinning trust store.
 *
 * Each peer is tracked by their userId. The first time we see their public key
 * we pin it as "new". The user can verify the safety code out-of-band and
 * promote the peer to "verified". If the key changes we flag them as "changed"
 * (potential MITM). Signing SPKI and X25519 enc are pinned together.
 */

export type TrustLevel = 'new' | 'trusted' | 'verified' | 'changed';

export interface TrustRecord {
  userId: string;
  /** SPKI base64 of the first-seen signing public key. */
  pinnedKeyB64: string;
  /** X25519 raw public key (base64) pinned with the signing key. */
  pinnedEncRawB64: string | null;
  /** Current sign key if it differs from pinnedKeyB64, else null. */
  currentKeyB64: string | null;
  /** Current enc key observed with a competing sign key. */
  currentEncRawB64: string | null;
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
 * Derive a 6-emoji safety code from two peers' sign+enc keys + roomId.
 * Order-independent: sign keys and enc keys are each sorted before hashing.
 */
export async function deriveEmojiSafetyCode(
  keyA_b64: string,
  keyB_b64: string,
  roomId = '',
  encA_b64 = '',
  encB_b64 = ''
): Promise<string> {
  const sortedSign = [keyA_b64, keyB_b64].sort();
  const sortedEnc = [encA_b64, encB_b64].sort();
  const input = new TextEncoder().encode(
    `${sortedSign.join('|')}|${sortedEnc.join('|')}|${roomId}`
  );
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
   * Observe a peer's public keys. Returns the trust level after the observation.
   * - First time: creates a "new" record (TOFU pin of sign + enc).
   * - Same sign key: fill pinned enc only if still null; never silently rotate it.
   * - Different sign key: sets level to "changed"; pinned enc is left untouched.
   */
  observe(userId: string, keyB64: string, encRawB64?: string): TrustLevel {
    const now = Date.now();
    const existing = this.records.get(userId);
    if (!existing) {
      this.records.set(userId, {
        userId,
        pinnedKeyB64: keyB64,
        pinnedEncRawB64: encRawB64 ?? null,
        currentKeyB64: null,
        currentEncRawB64: null,
        level: 'new',
        firstSeenMs: now,
        lastSeenMs: now,
      });
      this.emitChange();
      return 'new';
    }

    existing.lastSeenMs = now;
    if (existing.pinnedKeyB64 === keyB64) {
      // Pinned sign reappeared — clear competing current sign but keep `changed`
      // until explicit repin() / re-SAS (no silent auto-heal to trusted).
      let changed = false;
      if (existing.currentKeyB64) {
        existing.currentKeyB64 = null;
        changed = true;
      }
      if (!existing.pinnedEncRawB64 && encRawB64) {
        existing.pinnedEncRawB64 = encRawB64;
        existing.currentEncRawB64 = null;
        changed = true;
      } else if (
        encRawB64 &&
        existing.pinnedEncRawB64 &&
        existing.pinnedEncRawB64 !== encRawB64
      ) {
        // Enc rotation under same SPKI: stash for explicit repin/acceptEncRepin — do not redirect Susurros.
        if (existing.currentEncRawB64 !== encRawB64) {
          existing.currentEncRawB64 = encRawB64;
          changed = true;
        }
      }
      if (changed) this.emitChange();
      return existing.level;
    }

    existing.currentKeyB64 = keyB64;
    if (encRawB64) existing.currentEncRawB64 = encRawB64;
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

  getPinnedEnc(userId: string): string | null {
    return this.records.get(userId)?.pinnedEncRawB64 ?? null;
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

  /** Accept a key change: re-pin to the new sign (+ enc if observed). */
  repin(userId: string): void {
    const rec = this.records.get(userId);
    if (!rec || !rec.currentKeyB64) return;
    rec.pinnedKeyB64 = rec.currentKeyB64;
    if (rec.currentEncRawB64) {
      rec.pinnedEncRawB64 = rec.currentEncRawB64;
    }
    rec.currentKeyB64 = null;
    rec.currentEncRawB64 = null;
    rec.level = 'trusted';
    this.emitChange();
  }

  /** Accept enc-only rotation under the same pinned sign key. */
  acceptEncRepin(userId: string): void {
    const rec = this.records.get(userId);
    if (!rec || !rec.currentEncRawB64) return;
    if (rec.currentKeyB64 && rec.currentKeyB64 !== rec.pinnedKeyB64) return;
    rec.pinnedEncRawB64 = rec.currentEncRawB64;
    rec.currentEncRawB64 = null;
    // Sign pin is stable — heal stale `changed` left after a flap that settled.
    if (rec.level === 'changed' && !rec.currentKeyB64) {
      rec.level = 'trusted';
    }
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
