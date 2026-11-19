import {
  openDmBody,
  type EncryptionIdentity,
} from '../crypto/dmCrypto';
import { verifyDirectMessage } from '../crypto/messageSigning';
import {
  isValidDirectMessage,
  MAX_DM_BODY_CHARS,
  type DirectMessage,
} from '../protocol';
import type { VerifyKeyRegistry } from './verifyKeyRegistry';

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
  private readonly seenDmIds = new Set<string>();
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
      if (plain === null || !plain.trim()) return false;

      this.seenDmIds.add(dm.msgId);
      if (this.seenDmIds.size > 2_000) {
        const first = this.seenDmIds.values().next().value;
        if (first) this.seenDmIds.delete(first);
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
    this.seenDmIds.add(msgId);
  }

  async flushPendingForUser(userId: string): Promise<void> {
    const dms = this.pendingDms.get(userId);
    if (!dms?.length) return;
    this.pendingDms.delete(userId);
    for (const dm of dms) {
      await this.accept(dm, null);
    }
  }

  private queuePendingDm(dm: DirectMessage) {
    const list = this.pendingDms.get(dm.fromUserId) ?? [];
    if (list.some((d) => d.msgId === dm.msgId)) return;
    list.push(dm);
    if (list.length > 20) list.shift();
    this.pendingDms.set(dm.fromUserId, list);
  }
}
