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

/** Keep the newest sync window (shared by snapshot + clamp). */
export function tailSyncEvents(events: ForumEvent[]): ForumEvent[] {
  return events.slice(-MAX_SYNC_MESSAGES);
}

export function snapshotForSync(localMessages: Map<string, ForumEvent>): ForumEvent[] {
  const all = [...localMessages.values()];
  const deleted = deletedThreadIds(all);
  let list = tailSyncEvents(
    all
      .filter(
        (e) => !deleted.has(e.threadId) || !isContentForumType(e.type)
      )
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
  );

  // Keep halving until under wire budget (or empty).
  while (list.length > 0 && syncPayloadTooLarge(list)) {
    const next = Math.max(1, Math.floor(list.length / 2));
    if (next >= list.length) {
      list = list.slice(-1);
      if (syncPayloadTooLarge(list)) return [];
      break;
    }
    list = list.slice(-next);
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
  return tailSyncEvents(events);
}
