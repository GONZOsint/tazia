import { verifyForumEvent } from '../crypto/messageSigning';
import {
  isValidForumEvent,
  MAX_PUBLISH_PER_MINUTE,
  type ForumEvent,
} from '../protocol';
import type { PeerRateLimiter } from './rateLimit';
import type { VerifyKeyRegistry } from './verifyKeyRegistry';

const PENDING_TTL_MS = 60_000;

export interface ForumIngestDeps {
  rateLimiter: PeerRateLimiter;
  registry: VerifyKeyRegistry;
  localMessages: Map<string, ForumEvent>;
  onForumMessage: (event: ForumEvent) => void;
  onRejectedSync?: () => void;
}

export class ForumIngest {
  private readonly ingestingIds = new Set<string>();
  private readonly pendingLive = new Map<string, ForumEvent[]>();
  private readonly deps: ForumIngestDeps;

  constructor(deps: ForumIngestDeps) {
    this.deps = deps;
  }

  async ingest(
    event: ForumEvent,
    opts: { liveUserId?: string | null; source: 'live' | 'sync' | 'fallback' }
  ): Promise<boolean> {
    const clockSource = opts.source === 'sync' ? 'sync' : 'live';
    if (!isValidForumEvent(event, { clockSource })) {
      if (opts.source === 'sync') this.deps.onRejectedSync?.();
      return false;
    }

    if (opts.liveUserId) {
      if (event.authorUserId !== opts.liveUserId) return false;
      if (!this.deps.rateLimiter.allow(opts.liveUserId, MAX_PUBLISH_PER_MINUTE)) {
        return false;
      }
    } else if (opts.source === 'fallback' || opts.source === 'sync') {
      // No Trystero transport binding (fallback) / sync fan-in — rate-limit by author.
      if (!this.deps.rateLimiter.allow(event.authorUserId, MAX_PUBLISH_PER_MINUTE)) {
        return false;
      }
    }

    if (this.deps.localMessages.has(event.msgId) || this.ingestingIds.has(event.msgId)) {
      return false;
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

      if (this.deps.localMessages.has(event.msgId)) return false;
      this.deps.localMessages.set(event.msgId, event);
      this.deps.onForumMessage(event);
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
