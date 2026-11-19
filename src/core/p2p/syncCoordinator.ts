import {
  deletedThreadIds,
  isContentForumType,
} from '../forum/threadDelete';
import {
  MAX_SYNC_MESSAGES,
  MAX_SYNC_PEER_TARGETS,
  MAX_SYNC_TOTAL_BYTES,
  type ForumEvent,
} from '../protocol';

const te = new TextEncoder();

export function syncPayloadTooLarge(events: unknown): boolean {
  const raw = JSON.stringify(events);
  return te.encode(raw).byteLength > MAX_SYNC_TOTAL_BYTES;
}

export function snapshotForSync(localMessages: Map<string, ForumEvent>): ForumEvent[] {
  const all = [...localMessages.values()];
  const deleted = deletedThreadIds(all);
  const list = all
    .filter(
      (e) => !deleted.has(e.threadId) || !isContentForumType(e.type)
    )
    .sort((a, b) => a.createdAtMs - b.createdAtMs)
    .slice(-MAX_SYNC_MESSAGES);
  if (syncPayloadTooLarge(list)) {
    return list.slice(-Math.floor(list.length / 2));
  }
  return list;
}

/** Partial Fisher–Yates sample of peer ids for sync fan-out. */
export function sampleSyncTargets(allTargets: string[], max = MAX_SYNC_PEER_TARGETS): string[] {
  if (allTargets.length <= max) return allTargets;
  const pool = [...allTargets];
  for (let i = 0; i < max; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool.slice(0, max);
}

export function clampSyncEvents(events: ForumEvent[]): ForumEvent[] {
  return events.slice(0, MAX_SYNC_MESSAGES);
}
