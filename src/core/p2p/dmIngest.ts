import {
  openDmBody,
  type EncryptionIdentity,
} from '../crypto/dmCrypto';
import { verifyDirectMessage } from '../crypto/messageSigning';
import {
  isValidDirectMessage,
  LIVE_CLOCK_SKEW_MS,
  MAX_DM_BODY_CHARS,
  type DirectMessage,
} from '../protocol';
import type { VerifyKeyRegistry } from './verifyKeyRegistry';

const PENDING_TTL_MS = 60_000;
const SEEN_CAP = 2_000;

export interface DmIngestDeps {
  roomId: string;
  /** Mutable holder so self id can be set after Trystero getSelf(). */
  self: { userId: string };
  encIdentity: EncryptionIdentity;
  knownEncPubKeys: Map<string, string>;
  registry: VerifyKeyRegistry;
  onDirectMessage?: (dm: DirectMessage) => void;
}

export class DmIngest {
  private readonly seenDmIds = new Map<string, number>();
  private readonly ingestingIds = new Set<string>();
  private readonly pendingDms = new Map<string, DirectMessage[]>();
  private readonly deps: DmIngestDeps;

  constructor(deps: DmIngestDeps) {
    this.deps = deps;
  }

  async accept(dm: DirectMessage, transportUserId: string | null): Promise<boolean> {
    if (!isValidDirectMessage(dm)) return false;
    if (transportUserId && dm.fromUserId !== transportUserId) return false;
    if (dm.toUserId !== this.deps.self.userId) return false;
    this.pruneSeen(Date.now());
    if (this.seenDmIds.has(dm.msgId) || this.ingestingIds.has(dm.msgId)) return false;
    this.ingestingIds.add(dm.msgId);

    try {
      const verifyKey = await this.deps.registry.get(dm.fromUserId);
      if (!verifyKey) {
        this.queuePendingDm(dm);
        return false;
      }
      const ok = await verifyDirectMessage(dm, verifyKey);
      if (!ok) return false;

      const peerEnc = this.deps.knownEncPubKeys.get(dm.fromUserId);
      if (!peerEnc) {
        this.queuePendingDm(dm);
        return false;
      }

      const plain = await openDmBody({
        sealedB64: dm.bodyCipherB64,
        selfEnc: this.deps.encIdentity,
        peerEncPubB64: peerEnc,
        roomId: this.deps.roomId,
        fromUserId: dm.fromUserId,
        toUserId: dm.toUserId,
        msgId: dm.msgId,
      });
      // Sig ok but wrong/stale enc (e.g. pre-repin): keep pending for later flush.
      if (plain === null || !plain.trim()) {
        this.queuePendingDm(dm);
        return false;
      }

      this.seenDmIds.set(dm.msgId, dm.createdAtMs);
      if (this.seenDmIds.size > SEEN_CAP) {
        this.pruneSeen(Date.now(), true);
      }

      this.deps.onDirectMessage?.({
        ...dm,
        body: plain.slice(0, MAX_DM_BODY_CHARS),
        bodyCipherB64: dm.bodyCipherB64,
        seal: 2,
      });
      return true;
    } finally {
      this.ingestingIds.delete(dm.msgId);
    }
  }

  markSeenLocal(msgId: string): void {
    this.seenDmIds.set(msgId, Date.now());
  }

  async flushPendingForUser(userId: string): Promise<void> {
    const dms = this.pendingDms.get(userId);
    if (!dms?.length) return;
    this.pendingDms.delete(userId);
    for (const dm of dms) {
      await this.accept(dm, null);
    }
  }

  private pruneSeen(now: number, forceEvictOldest = false) {
    const cutoff = now - LIVE_CLOCK_SKEW_MS;
    for (const [id, at] of this.seenDmIds) {
      if (at < cutoff) this.seenDmIds.delete(id);
    }
    if (forceEvictOldest && this.seenDmIds.size > SEEN_CAP) {
      // Only drop ids older than skew window; if still over cap, drop oldest.
      const oldest = [...this.seenDmIds.entries()].sort((a, b) => a[1] - b[1]);
      for (const [id] of oldest) {
        if (this.seenDmIds.size <= SEEN_CAP) break;
        this.seenDmIds.delete(id);
      }
    }
  }

  private queuePendingDm(dm: DirectMessage) {
    const list = this.pendingDms.get(dm.fromUserId) ?? [];
    if (list.some((d) => d.msgId === dm.msgId)) return;
    list.push(dm);
    if (list.length > 20) list.shift();
    this.pendingDms.set(dm.fromUserId, list);
    window.setTimeout(() => {
      const cur = this.pendingDms.get(dm.fromUserId);
      if (!cur) return;
      const next = cur.filter((d) => d.msgId !== dm.msgId);
      if (next.length) this.pendingDms.set(dm.fromUserId, next);
      else this.pendingDms.delete(dm.fromUserId);
    }, PENDING_TTL_MS);
  }
}
