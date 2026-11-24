import {
  digestSyncEvents,
  signSyncRes,
  verifySyncRes,
  type SigningIdentity,
} from '../crypto/messageSigning';
import { MAX_SYNC_ANSWERS_PER_MINUTE, type ForumEvent } from '../protocol';
import type { ForumIngest } from './forumIngest';
import { allowPeerAndGlobal, type PeerRateLimiter } from './rateLimit';
import { clampSyncEvents, syncPayloadTooLarge } from './syncCoordinator';
import type { VerifyKeyRegistry } from './verifyKeyRegistry';

/** Signed sync snapshot payload (WebRTC answer or Nostr sync-res body). */
export interface SyncResPayload {
  events: ForumEvent[];
  fromUserId: string;
  eventsDigest: string;
  sig: string;
}

export type ForumSyncResponse = SyncResPayload;

export const WEBRTC_SYNC_REQ_ID = 'webrtc-sync';

/** Soft global budget for sync answers (anti ID-rotation amp). */
export const MAX_GLOBAL_SYNC_ANSWERS_PER_MINUTE = MAX_SYNC_ANSWERS_PER_MINUTE * 3;

const NOSTR_SYNC_TIMEOUT_MS = 8_000;
/** After first successful merge, wait this long for additional sync-res then resolve. */
const NOSTR_SYNC_GRACE_MS = 600;

export interface SyncVerifyDeps {
  roomId: string;
  self: { userId: string };
  signing: SigningIdentity;
  registry: VerifyKeyRegistry;
  forumIngest: ForumIngest;
  syncAnswerLimiter: PeerRateLimiter;
  getEventsForSync: () => ForumEvent[];
  /** Fired after envelope-level sync rejects (sig/digest/transport) so UI can refresh. */
  onRejectedSync?: () => void;
}

export class SyncVerify {
  private rejectedSyncCount = 0;
  private readonly pendingSync = new Map<
    string,
    {
      resolve: (n: number) => void;
      added: number;
      timer: number;
      graceTimer: number | null;
    }
  >();
  private readonly deps: SyncVerifyDeps;

  constructor(deps: SyncVerifyDeps) {
    this.deps = deps;
  }

  getRejectedSyncCount(): number {
    return this.rejectedSyncCount;
  }

  noteRejected(): void {
    this.rejectedSyncCount += 1;
  }

  /** Increment counter and notify UI once (envelope rejects). */
  private rejectOnce(): void {
    this.rejectedSyncCount += 1;
    this.deps.onRejectedSync?.();
  }

  /** Per-peer + global amp budget (WebRTC peer id or `nostr:<pubkey>`). */
  allowSyncAnswer(peerKey: string): boolean {
    return allowPeerAndGlobal(
      this.deps.syncAnswerLimiter,
      peerKey,
      MAX_SYNC_ANSWERS_PER_MINUTE,
      '__global_sync__',
      MAX_GLOBAL_SYNC_ANSWERS_PER_MINUTE
    );
  }

  async buildSignedSyncPayload(
    toUserId: string,
    reqId: string
  ): Promise<ForumSyncResponse> {
    const events = this.deps.getEventsForSync();
    const eventsDigest = await digestSyncEvents(events);
    const sig = await signSyncRes(
      this.deps.signing,
      this.deps.roomId,
      reqId,
      this.deps.self.userId,
      toUserId,
      eventsDigest
    );
    return {
      events,
      fromUserId: this.deps.self.userId,
      eventsDigest,
      sig,
    };
  }

  /**
   * Verify a signed sync snapshot and ingest accepted events.
   * Returns number of newly ingested events (0 on soft reject).
   */
  async verifyAndIngestSyncPayload(opts: {
    events: ForumEvent[];
    eventsDigest: string;
    sig: string;
    fromUserId: string;
    reqId: string;
    /** When set, transport peer must match claimed fromUserId. */
    transportUserId?: string | null;
  }): Promise<number> {
    // Soft skip: rate-limited peer answered with empty payload (trysteroIngress).
    if (
      Array.isArray(opts.events) &&
      opts.events.length === 0 &&
      !opts.fromUserId &&
      !opts.sig
    ) {
      return 0;
    }
    if (opts.transportUserId != null && opts.transportUserId !== opts.fromUserId) {
      this.rejectOnce();
      return 0;
    }
    if (!Array.isArray(opts.events) || !opts.fromUserId || !opts.sig) {
      this.rejectOnce();
      return 0;
    }
    if (syncPayloadTooLarge(opts.events)) {
      this.rejectOnce();
      return 0;
    }
    const clamped = clampSyncEvents(opts.events);
    const digest = await digestSyncEvents(clamped);
    if (digest !== opts.eventsDigest) {
      this.rejectOnce();
      return 0;
    }
    const verifyKey = await this.deps.registry.get(opts.fromUserId);
    if (!verifyKey) {
      this.rejectOnce();
      return 0;
    }
    const okSig = await verifySyncRes(
      verifyKey,
      this.deps.roomId,
      opts.reqId,
      opts.fromUserId,
      this.deps.self.userId,
      opts.eventsDigest,
      opts.sig
    );
    if (!okSig) {
      this.rejectOnce();
      return 0;
    }
    let added = 0;
    for (const item of clamped) {
      const ok = await this.deps.forumIngest.ingest(item, {
        liveUserId: null,
        source: 'sync',
      });
      if (ok) added += 1;
    }
    return added;
  }

  private finishNostrSync(reqId: string): void {
    const p = this.pendingSync.get(reqId);
    if (!p) return;
    clearTimeout(p.timer);
    if (p.graceTimer !== null) clearTimeout(p.graceTimer);
    this.pendingSync.delete(reqId);
    p.resolve(p.added);
  }

  private armNostrGrace(reqId: string): void {
    const p = this.pendingSync.get(reqId);
    if (!p || p.graceTimer !== null) return;
    clearTimeout(p.timer);
    p.graceTimer = setTimeout(() => {
      this.finishNostrSync(reqId);
    }, NOSTR_SYNC_GRACE_MS) as unknown as number;
  }

  /** Merge Nostr sync-res into an open pending request until grace/timeout. */
  applyNostrSyncResponse(
    reqId: string,
    fromUserId: string,
    events: ForumEvent[],
    eventsDigest: string,
    sig: string
  ): void {
    void (async () => {
      const pending = this.pendingSync.get(reqId);
      if (!pending) return;
      const added = await this.verifyAndIngestSyncPayload({
        events,
        eventsDigest,
        sig,
        fromUserId,
        reqId,
      });
      const still = this.pendingSync.get(reqId);
      if (!still) return;
      const wasEmpty = still.added === 0;
      still.added += added;
      if (still.added > 0 && (wasEmpty || added > 0)) {
        this.armNostrGrace(reqId);
      }
    })();
  }

  beginNostrSyncRequest(
    publish: (env: {
      v: 2;
      t: 'sync-req';
      fromUserId: string;
      reqId: string;
    }) => Promise<boolean | void>
  ): Promise<number> {
    const reqId = crypto.randomUUID();
    return new Promise<number>((resolve) => {
      const timer = setTimeout(() => {
        this.finishNostrSync(reqId);
      }, NOSTR_SYNC_TIMEOUT_MS) as unknown as number;
      this.pendingSync.set(reqId, { resolve, added: 0, timer, graceTimer: null });
      void publish({
        v: 2,
        t: 'sync-req',
        fromUserId: this.deps.self.userId,
        reqId,
      })
        .then((ok) => {
          if (ok === false) this.finishNostrSync(reqId);
        })
        .catch(() => {
          this.finishNostrSync(reqId);
        });
    });
  }

  clearPending(): void {
    for (const pending of this.pendingSync.values()) {
      clearTimeout(pending.timer);
      if (pending.graceTimer !== null) clearTimeout(pending.graceTimer);
      pending.resolve(pending.added);
    }
    this.pendingSync.clear();
  }
}
