import type { ForumEvent, ForumMessageType } from '../protocol';

/** Fixed body for an aye delete vote. */
export const DELETE_VOTE_AYE = 'aye';

const SAFE_ID_RE = /^[A-Za-z0-9_-]+$/;
const MAX_USER_ID_CHARS = 64;

/** Stable across locales — electorate encoding must match on every peer. */
function sortUserIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b, 'en'));
}

export function isContentForumType(type: ForumMessageType): boolean {
  return type === 'NEW_THREAD' || type === 'REPLY';
}

export function isDeleteForumType(type: ForumMessageType): boolean {
  return type === 'DELETE_PROPOSE' || type === 'DELETE_VOTE';
}

/** Sorted unique peer ids frozen into a DELETE_PROPOSE body. */
export function encodeElectorate(userIds: string[]): string {
  const unique = [
    ...new Set(
      userIds.filter(
        (id) =>
          typeof id === 'string' &&
          id.length >= 4 &&
          id.length <= MAX_USER_ID_CHARS &&
          SAFE_ID_RE.test(id)
      )
    ),
  ];
  return sortUserIds(unique).join(',');
}

export function decodeElectorate(body: string): string[] | null {
  if (!body || body.length > 8000) return null;
  const parts = body.split(',');
  if (parts.length === 0) return null;
  const seen = new Set<string>();
  for (const id of parts) {
    if (
      id.length < 4 ||
      id.length > MAX_USER_ID_CHARS ||
      !SAFE_ID_RE.test(id) ||
      seen.has(id)
    ) {
      return null;
    }
    seen.add(id);
  }
  const sorted = sortUserIds(parts);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] !== sorted[i]) return null;
  }
  return parts;
}

export function isValidDeleteElectorateBody(body: string, authorUserId: string): boolean {
  const ids = decodeElectorate(body);
  if (!ids || ids.length === 0) return false;
  return ids.includes(authorUserId);
}

/**
 * Live/fallback guard: electorate must cover peers already online when the
 * propose was created (superset OK). Peers first seen after `createdAtMs`
 * (+skew) may be omitted — avoids join races rejecting honest proposes.
 * Shrinking below the then-online set is rejected.
 */
export function electorateCoversOnline(
  electorate: string[],
  onlineUserIds: string[],
  opts?: {
    createdAtMs?: number;
    peerFirstSeenAtMs?: (userId: string) => number | undefined;
    joinSkewMs?: number;
  }
): boolean {
  const createdAtMs = opts?.createdAtMs;
  const skew = opts?.joinSkewMs ?? 2_000;
  for (const id of onlineUserIds) {
    if (!id) continue;
    if (electorate.includes(id)) continue;
    if (createdAtMs !== undefined && opts?.peerFirstSeenAtMs) {
      const seen = opts.peerFirstSeenAtMs(id);
      if (seen !== undefined && seen > createdAtMs + skew) continue;
    }
    return false;
  }
  return true;
}

export interface ThreadDeleteBallot {
  threadId: string;
  proposalMsgId: string;
  electorate: string[];
  /** Aye voters (proposer always included). */
  votes: string[];
  complete: boolean;
}

function ballotFromProposal(
  proposal: ForumEvent,
  all: ForumEvent[]
): ThreadDeleteBallot | null {
  if (proposal.type !== 'DELETE_PROPOSE') return null;
  const electorate = decodeElectorate(proposal.body);
  if (!electorate) return null;

  const voters = new Set<string>([proposal.authorUserId]);
  for (const ev of all) {
    if (ev.type !== 'DELETE_VOTE') continue;
    if (ev.parentMsgId !== proposal.msgId) continue;
    if (ev.threadId !== proposal.threadId) continue;
    if (ev.body !== DELETE_VOTE_AYE) continue;
    if (!electorate.includes(ev.authorUserId)) continue;
    voters.add(ev.authorUserId);
  }

  const votes = electorate.filter((id) => voters.has(id));
  return {
    threadId: proposal.threadId,
    proposalMsgId: proposal.msgId,
    electorate,
    votes,
    complete: votes.length === electorate.length,
  };
}

/** Proposals oldest-first. */
export function collectDeleteBallots(events: ForumEvent[]): ThreadDeleteBallot[] {
  const proposals = events
    .filter((e) => e.type === 'DELETE_PROPOSE')
    .sort((a, b) => a.createdAtMs - b.createdAtMs || a.msgId.localeCompare(b.msgId, 'en'));

  const out: ThreadDeleteBallot[] = [];
  for (const p of proposals) {
    const ballot = ballotFromProposal(p, events);
    if (ballot) out.push(ballot);
  }
  return out;
}

/** Earliest proposal per thread only — later proposes cannot authorize a delete. */
export function primaryBallotForThread(
  events: ForumEvent[],
  threadId: string
): ThreadDeleteBallot | null {
  for (const b of collectDeleteBallots(events)) {
    if (b.threadId === threadId) return b;
  }
  return null;
}

export function deletedThreadIds(events: ForumEvent[]): Set<string> {
  const seenThread = new Set<string>();
  const deleted = new Set<string>();
  for (const b of collectDeleteBallots(events)) {
    if (seenThread.has(b.threadId)) continue;
    seenThread.add(b.threadId);
    if (b.complete) deleted.add(b.threadId);
  }
  return deleted;
}

/** Earliest incomplete ballot for a thread, if any. */
export function openBallotForThread(
  events: ForumEvent[],
  threadId: string
): ThreadDeleteBallot | null {
  const primary = primaryBallotForThread(events, threadId);
  if (!primary || primary.complete) return null;
  return primary;
}

/** True if this thread already has any DELETE_PROPOSE (one propose per thread). */
export function hasDeleteProposeForThread(
  events: ForumEvent[],
  threadId: string
): boolean {
  return events.some((e) => e.type === 'DELETE_PROPOSE' && e.threadId === threadId);
}

/**
 * If `trigger` completed the *primary* ballot for its thread, return that threadId.
 */
export function threadDeletedByEvent(
  events: ForumEvent[],
  trigger: ForumEvent
): string | null {
  if (!isDeleteForumType(trigger.type)) return null;
  const primary = primaryBallotForThread(events, trigger.threadId);
  if (!primary?.complete) return null;
  if (trigger.type === 'DELETE_PROPOSE' && trigger.msgId === primary.proposalMsgId) {
    return primary.threadId;
  }
  if (
    trigger.type === 'DELETE_VOTE' &&
    trigger.parentMsgId === primary.proposalMsgId
  ) {
    return primary.threadId;
  }
  return null;
}

/** Drop talk content for a deleted thread; keep DELETE_* tombstones. */
export function purgeThreadContent(
  localMessages: Map<string, ForumEvent>,
  threadId: string
): number {
  let n = 0;
  for (const [msgId, ev] of localMessages) {
    if (ev.threadId === threadId && isContentForumType(ev.type)) {
      localMessages.delete(msgId);
      n += 1;
    }
  }
  return n;
}

/**
 * Structural delete rules (no crypto). Shared by ingest + local publish.
 * Returns why rejected, or null if OK.
 */
export function rejectDeleteEventReason(
  event: ForumEvent,
  localMessages: Map<string, ForumEvent>,
  opts: {
    source: 'live' | 'sync' | 'fallback';
    onlineUserIds?: string[];
    peerFirstSeenAtMs?: (userId: string) => number | undefined;
  }
): string | null {
  const existing = [...localMessages.values()];

  if (event.type === 'DELETE_PROPOSE') {
    if (hasDeleteProposeForThread(existing, event.threadId)) {
      return 'delete-propose-exists';
    }
    const electorate = decodeElectorate(event.body);
    if (!electorate) return 'delete-electorate-invalid';
    // Live/fallback: must cover peers already online at propose time.
    if (opts.source === 'live' || opts.source === 'fallback') {
      const online = opts.onlineUserIds ?? [];
      if (
        !electorateCoversOnline(electorate, online, {
          createdAtMs: event.createdAtMs,
          peerFirstSeenAtMs: opts.peerFirstSeenAtMs,
        })
      ) {
        return 'delete-electorate-incomplete';
      }
    }
    return null;
  }

  if (event.type === 'DELETE_VOTE') {
    const parentId = event.parentMsgId;
    if (!parentId) return 'delete-vote-no-parent';
    const proposal = localMessages.get(parentId);
    if (!proposal) return 'delete-vote-parent-missing';
    if (proposal.type !== 'DELETE_PROPOSE') return 'delete-vote-bad-parent';
    if (proposal.threadId !== event.threadId) return 'delete-vote-thread-mismatch';
    const primary = primaryBallotForThread(existing, event.threadId);
    if (primary && primary.proposalMsgId !== proposal.msgId) {
      return 'delete-vote-not-primary';
    }
    const electorate = decodeElectorate(proposal.body);
    if (!electorate?.includes(event.authorUserId)) return 'delete-vote-not-elector';
    return null;
  }

  return null;
}
