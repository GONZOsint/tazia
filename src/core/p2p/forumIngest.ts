import { verifyForumEvent } from '../crypto/messageSigning';
import {
  deletedThreadIds,
  isContentForumType,
  purgeThreadContent,
  rejectDeleteEventReason,
  threadDeletedByEvent,
} from '../forum/threadDelete';
import {
  isValidForumEvent,
  MAX_PUBLISH_PER_MINUTE,
  type ForumEvent,
} from '../protocol';
import type { PeerRateLimiter } from './rateLimit';
import { snapshotForSync } from './syncCoordinator';
import type { VerifyKeyRegistry } from './verifyKeyRegistry';

const PENDING_TTL_MS = 60_000;

export interface ForumIngestDeps {
  rateLimiter: PeerRateLimiter;
  registry: VerifyKeyRegistry;
  onForumMessage: (event: ForumEvent) => void;
  /** Fired when a unanimous delete ballot completes and talk content is purged. */
  onThreadDeleted?: (threadId: string) => void;
  /** Live/fallback electorate cover check. */
  getOnlineUserIds?: () => string[];
  /** When each peer was first seen online (for join-race skew). */
  peerFirstSeenAtMs?: (userId: string) => number | undefined;
  onRejectedSync?: () => void;
}

export class ForumIngest {
  private readonly localMessages = new Map<string, ForumEvent>();
  private readonly ingestingIds = new Set<string>();
  private readonly pendingLive = new Map<string, ForumEvent[]>();
  /** DELETE_VOTE waiting for parent DELETE_PROPOSE (keyed by parentMsgId). */
  private readonly pendingDeleteVotes = new Map<string, ForumEvent[]>();
  private readonly deps: ForumIngestDeps;

  constructor(deps: ForumIngestDeps) {
    this.deps = deps;
  }

  /** Snapshot for signed sync answers (size-capped). */
  getEventsForSync(): ForumEvent[] {
    return snapshotForSync(this.localMessages);
  }

  async ingest(
    event: ForumEvent,
    opts: {
      liveUserId?: string | null;
      source: 'live' | 'sync' | 'fallback';
      /** Local publish already consumed a rate-limit token. */
      skipRateLimit?: boolean;
    }
  ): Promise<boolean> {
    const clockSource = opts.source === 'sync' ? 'sync' : 'live';
    if (!isValidForumEvent(event, { clockSource })) {
      if (opts.source === 'sync') this.deps.onRejectedSync?.();
      return false;
    }

    if (!opts.skipRateLimit) {
      if (opts.liveUserId) {
        if (event.authorUserId !== opts.liveUserId) return false;
        if (!this.deps.rateLimiter.allow(opts.liveUserId, MAX_PUBLISH_PER_MINUTE)) {
          return false;
        }
      } else if (opts.source === 'fallback' || opts.source === 'sync') {
        if (!this.deps.rateLimiter.allow(event.authorUserId, MAX_PUBLISH_PER_MINUTE)) {
          return false;
        }
      }
    } else if (opts.liveUserId && event.authorUserId !== opts.liveUserId) {
      return false;
    }

    if (this.localMessages.has(event.msgId) || this.ingestingIds.has(event.msgId)) {
      return false;
    }

    if (isContentForumType(event.type)) {
      if (deletedThreadIds([...this.localMessages.values()]).has(event.threadId)) {
        return false;
      }
    }

    if (event.type === 'DELETE_PROPOSE' || event.type === 'DELETE_VOTE') {
      const reason = rejectDeleteEventReason(event, this.localMessages, {
        source: opts.source,
        onlineUserIds: this.deps.getOnlineUserIds?.() ?? [],
        peerFirstSeenAtMs: this.deps.peerFirstSeenAtMs,
      });
      if (reason === 'delete-vote-parent-missing') {
        if (opts.source === 'sync') {
          this.deps.onRejectedSync?.();
          return false;
        }
        this.queuePendingDeleteVote(event);
        return false;
      }
      if (reason) {
        if (opts.source === 'sync') this.deps.onRejectedSync?.();
        return false;
      }
    }

    this.ingestingIds.add(event.msgId);

    try {
      const verifyKey = await this.deps.registry.get(event.authorUserId);
      if (!verifyKey) {
        this.ingestingIds.delete(event.msgId);
        if (opts.source === 'sync') {
          this.deps.onRejectedSync?.();
          return false;
        }
        this.queuePendingLive(event);
        return false;
      }

      const ok = await verifyForumEvent(event, verifyKey);
      if (!ok) {
        if (opts.source === 'sync') this.deps.onRejectedSync?.();
        return false;
      }

      // Re-check delete rules after await (race with concurrent propose).
      if (event.type === 'DELETE_PROPOSE' || event.type === 'DELETE_VOTE') {
        const reason = rejectDeleteEventReason(event, this.localMessages, {
          source: opts.source,
          onlineUserIds: this.deps.getOnlineUserIds?.() ?? [],
          peerFirstSeenAtMs: this.deps.peerFirstSeenAtMs,
        });
        if (reason) {
          if (opts.source === 'sync') this.deps.onRejectedSync?.();
          return false;
        }
      }

      if (this.localMessages.has(event.msgId)) return false;
      this.localMessages.set(event.msgId, event);
      this.deps.onForumMessage(event);

      const deletedId = threadDeletedByEvent([...this.localMessages.values()], event);
      if (deletedId) {
        purgeThreadContent(this.localMessages, deletedId);
        this.deps.onThreadDeleted?.(deletedId);
      }

      if (event.type === 'DELETE_PROPOSE') {
        await this.flushPendingDeleteVotes(event.msgId, opts.source);
      }
      return true;
    } finally {
      this.ingestingIds.delete(event.msgId);
    }
  }

  async flushPendingForUser(userId: string): Promise<void> {
    const events = this.pendingLive.get(userId);
    if (!events?.length) return;
    this.pendingLive.delete(userId);
    for (const ev of events) {
      await this.ingest(ev, { liveUserId: ev.authorUserId, source: 'live' });
    }
  }

  private async flushPendingDeleteVotes(
    proposalMsgId: string,
    source: 'live' | 'sync' | 'fallback'
  ): Promise<void> {
    const votes = this.pendingDeleteVotes.get(proposalMsgId);
    if (!votes?.length) return;
    this.pendingDeleteVotes.delete(proposalMsgId);
    for (const vote of votes) {
      await this.ingest(vote, {
        liveUserId: source === 'live' ? vote.authorUserId : null,
        source,
        skipRateLimit: true,
      });
    }
  }

  private queuePendingDeleteVote(event: ForumEvent) {
    const parentId = event.parentMsgId;
    if (!parentId) return;
    const list = this.pendingDeleteVotes.get(parentId) ?? [];
    if (list.some((e) => e.msgId === event.msgId)) return;
    list.push(event);
    if (list.length > 40) list.shift();
    this.pendingDeleteVotes.set(parentId, list);
    window.setTimeout(() => {
      const cur = this.pendingDeleteVotes.get(parentId);
      if (!cur) return;
      const next = cur.filter((e) => e.msgId !== event.msgId);
      if (next.length) this.pendingDeleteVotes.set(parentId, next);
      else this.pendingDeleteVotes.delete(parentId);
    }, PENDING_TTL_MS);
  }

  private queuePendingLive(event: ForumEvent) {
    const list = this.pendingLive.get(event.authorUserId) ?? [];
    if (list.some((e) => e.msgId === event.msgId)) return;
    list.push(event);
    if (list.length > 40) list.shift();
    this.pendingLive.set(event.authorUserId, list);
    window.setTimeout(() => {
      const cur = this.pendingLive.get(event.authorUserId);
      if (!cur) return;
      const next = cur.filter((e) => e.msgId !== event.msgId);
      if (next.length) this.pendingLive.set(event.authorUserId, next);
      else this.pendingLive.delete(event.authorUserId);
    }, PENDING_TTL_MS);
  }
}
