import type { PresenceState } from '../protocol';
import type { TrustStore } from '../trust/trustStore';
import type { DmIngest } from './dmIngest';
import type { VerifyKeyRegistry } from './verifyKeyRegistry';

export interface PresenceKeysDeps {
  trustStore: TrustStore;
  registry: VerifyKeyRegistry;
  knownEncPubKeys: Map<string, string>;
  dmIngest: DmIngest;
}

/**
 * TOFU pin + enc map. Enc only updates when observed SPKI matches the pin
 * (never on `changed`). WebRTC presence wins over conflicting Nostr for initial pin.
 */
export class PresenceKeys {
  private readonly webrtcPinned = new Set<string>();
  private readonly lastAttestAtMs = new Map<string, number>();
  private readonly deps: PresenceKeysDeps;
  /** Fired when knownEnc map gains/updates a peer (dm-wrap retry, etc.). */
  private onKnownEncUpdated: (() => void) | null = null;

  constructor(deps: PresenceKeysDeps) {
    this.deps = deps;
  }

  setOnKnownEncUpdated(cb: (() => void) | null): void {
    this.onKnownEncUpdated = cb;
  }

  markSelfWebrtcPinned(userId: string): void {
    this.webrtcPinned.add(userId);
  }

  acceptAttestAtMs(userId: string, atMs: number): boolean {
    const prev = this.lastAttestAtMs.get(userId);
    if (prev !== undefined && atMs <= prev) return false;
    this.lastAttestAtMs.set(userId, atMs);
    return true;
  }

  async rememberPresenceKeys(
    userId: string,
    state: PresenceState,
    source: 'webrtc' | 'nostr'
  ): Promise<void> {
    const { trustStore, registry, knownEncPubKeys, dmIngest } = this.deps;

    if (source === 'nostr' && this.webrtcPinned.has(userId)) {
      const pinned = trustStore.get(userId)?.pinnedKeyB64;
      if (pinned && pinned !== state.signPubKeySpkiB64) {
        // Surface key-change alert; do not redirect Susurro enc to attacker.
        await registry.observe(userId, state.signPubKeySpkiB64, state.encPubKeyRawB64);
        return;
      }
    }

    await registry.observe(userId, state.signPubKeySpkiB64, state.encPubKeyRawB64);
    if (source === 'webrtc') this.webrtcPinned.add(userId);

    const rec = trustStore.get(userId);
    if (!rec || rec.pinnedKeyB64 !== state.signPubKeySpkiB64) {
      // `changed`: keep prior pinned enc in knownEncPubKeys (if any).
      return;
    }

    const pinnedEnc = rec.pinnedEncRawB64 ?? state.encPubKeyRawB64;
    const prev = knownEncPubKeys.get(userId);
    knownEncPubKeys.set(userId, pinnedEnc);
    if (prev !== pinnedEnc) {
      void dmIngest.flushPendingForUser(userId);
      this.onKnownEncUpdated?.();
    }
  }

  clearEnc(userId: string): void {
    this.deps.knownEncPubKeys.delete(userId);
  }
}
