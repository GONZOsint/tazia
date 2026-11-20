import { useEffect, useRef } from 'react';
import { haptic, HAPTIC_RITUAL } from '../../motion/haptic';
import type { ThreadGroup } from './types';

/** Bonfire delete exit — haptic once per threadId when the tombstone lands. */
export function useForumDeleteHaptic(
  snapshotThreads: ThreadGroup[],
  deletedIds: Set<string>,
  roomId: string
) {
  const threadSnapshotsRef = useRef<Map<string, ThreadGroup>>(new Map());
  const playedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    threadSnapshotsRef.current = new Map();
    playedRef.current = new Set();
  }, [roomId]);

  useEffect(() => {
    for (const th of snapshotThreads) {
      threadSnapshotsRef.current.set(th.threadId, th);
    }
  }, [snapshotThreads]);

  useEffect(() => {
    for (const id of deletedIds) {
      if (playedRef.current.has(id)) continue;
      if (!threadSnapshotsRef.current.has(id)) continue;
      playedRef.current.add(id);
      haptic(HAPTIC_RITUAL);
    }
  }, [deletedIds]);
}
