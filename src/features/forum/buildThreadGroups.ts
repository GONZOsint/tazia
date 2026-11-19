import {
  collectDeleteBallots,
  deletedThreadIds,
  isContentForumType,
} from '../../core/forum/threadDelete';
import type { ForumMessage } from '../../core/protocol';
import type { ThreadGroup } from './types';

export function computeDeletedIds(messages: ForumMessage[]): Set<string> {
  return deletedThreadIds(messages);
}

export function computePendingDeleteIds(messages: ForumMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const b of collectDeleteBallots(messages)) {
    if (!b.complete) ids.add(b.threadId);
  }
  return ids;
}

/** Group content messages into threads (excludes deleted); optional title/body search. */
export function buildThreadGroups(
  messages: ForumMessage[],
  deletedIds: Set<string>,
  untitledLabel: string,
  searchQuery = ''
): ThreadGroup[] {
  const map = new Map<string, ForumMessage[]>();
  for (const msg of messages) {
    if (!isContentForumType(msg.type)) continue;
    if (deletedIds.has(msg.threadId)) continue;
    const arr = map.get(msg.threadId) ?? [];
    arr.push(msg);
    map.set(msg.threadId, arr);
  }

  const groups: ThreadGroup[] = [];
  for (const [threadId, list] of map.entries()) {
    const sorted = [...list].sort((a, b) => a.createdAtMs - b.createdAtMs);
    const root = sorted.find((m) => m.type === 'NEW_THREAD') ?? sorted[0];
    if (!root || root.type !== 'NEW_THREAD') continue;
    const replies = sorted.filter((m) => m.msgId !== root.msgId && m.type === 'REPLY');
    groups.push({
      threadId,
      title: root.title || untitledLabel,
      rootPost: root,
      replies,
      lastActivityMs: sorted[sorted.length - 1]!.createdAtMs,
    });
  }

  groups.sort((a, b) => b.lastActivityMs - a.lastActivityMs);

  const q = searchQuery.trim().toLowerCase();
  if (!q) return groups;
  return groups.filter(
    (g) =>
      g.title.toLowerCase().includes(q) ||
      g.rootPost.body.toLowerCase().includes(q) ||
      g.replies.some((r) => r.body.toLowerCase().includes(q))
  );
}

/** Unfiltered content threads (for empty-state vs search-no-results). */
export function hasAnyContentThreads(
  messages: ForumMessage[],
  deletedIds: Set<string>
): boolean {
  return messages.some((m) => isContentForumType(m.type) && !deletedIds.has(m.threadId));
}
