import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { TALK_EXTINGUISH } from '../../motion/tokens';
import { haptic, HAPTIC_RITUAL } from '../../motion/haptic';
import type { ThreadGroup } from './types';

/**
 * Talk ash exit after unanimous delete.
 * Snapshots every visible thread so deletes always find a snap; queues one ritual
 * at a time (later deletes are not marked played until their turn).
 */
export function useForumAshRitual(
  /** Prefer unfiltered groups so search cannot starve snapshots. */
  snapshotThreads: ThreadGroup[],
  deletedIds: Set<string>,
  roomId: string,
  onAshStart: (threadId: string) => void
) {
  const reduceMotion = useReducedMotion();
  const [ashThread, setAshThread] = useState<ThreadGroup | null>(null);
  const threadSnapshotsRef = useRef<Map<string, ThreadGroup>>(new Map());
  const ashPlayedRef = useRef<Set<string>>(new Set());
  const pendingAshRef = useRef<string[]>([]);

  useEffect(() => {
    setAshThread(null);
    threadSnapshotsRef.current = new Map();
    ashPlayedRef.current = new Set();
    pendingAshRef.current = [];
  }, [roomId]);

  // Snapshot while threads are still listed (before delete removes them).
  useEffect(() => {
    for (const th of snapshotThreads) {
      threadSnapshotsRef.current.set(th.threadId, th);
    }
  }, [snapshotThreads]);

  // Enqueue newly deleted ids that have a snap and are not yet played/queued.
  useEffect(() => {
    for (const id of deletedIds) {
      if (ashPlayedRef.current.has(id)) continue;
      if (pendingAshRef.current.includes(id)) continue;
      if (!threadSnapshotsRef.current.has(id)) continue;
      pendingAshRef.current.push(id);
    }
  }, [deletedIds]);

  // Drain queue one at a time.
  useEffect(() => {
    if (ashThread) return;
    while (pendingAshRef.current.length > 0) {
      const id = pendingAshRef.current.shift()!;
      if (ashPlayedRef.current.has(id)) continue;
      const snap = threadSnapshotsRef.current.get(id);
      if (!snap) continue;
      ashPlayedRef.current.add(id);
      setAshThread(snap);
      onAshStart(id);
      haptic(HAPTIC_RITUAL);
      return;
    }
  }, [ashThread, deletedIds, onAshStart]);

  const clearAsh = useCallback(() => {
    setAshThread(null);
  }, []);

  useEffect(() => {
    if (!ashThread) return;
    const ms = (reduceMotion ? TALK_EXTINGUISH.reducedMs : TALK_EXTINGUISH.finishMs) + 400;
    const timer = window.setTimeout(clearAsh, ms);
    return () => window.clearTimeout(timer);
  }, [ashThread, reduceMotion, clearAsh]);

  return {
    ashThread,
    clearAsh,
    reduceMotion: Boolean(reduceMotion),
  };
}
