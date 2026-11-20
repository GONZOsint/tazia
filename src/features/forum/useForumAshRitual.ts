import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { haptic, HAPTIC_RITUAL } from '../../motion/haptic';
import type { ThreadGroup } from './types';

/**
 * Talk delete exit — pixel TalkAshOverlay disabled for now (keep QR fire).
 * Marks deleted threads as handled without staging incinerate UI.
 */
export function useForumAshRitual(
  snapshotThreads: ThreadGroup[],
  deletedIds: Set<string>,
  roomId: string,
  _onAshStart: (threadId: string) => void
) {
  const reduceMotion = useReducedMotion();
  /** Always null while pixel ash is off — API kept for ForumWorkspace. */
  const [ashThread] = useState<ThreadGroup | null>(null);
  const threadSnapshotsRef = useRef<Map<string, ThreadGroup>>(new Map());
  const ashPlayedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    threadSnapshotsRef.current = new Map();
    ashPlayedRef.current = new Set();
  }, [roomId]);

  useEffect(() => {
    for (const th of snapshotThreads) {
      threadSnapshotsRef.current.set(th.threadId, th);
    }
  }, [snapshotThreads]);

  useEffect(() => {
    for (const id of deletedIds) {
      if (ashPlayedRef.current.has(id)) continue;
      if (!threadSnapshotsRef.current.has(id)) continue;
      ashPlayedRef.current.add(id);
      haptic(HAPTIC_RITUAL);
    }
  }, [deletedIds]);

  const clearAsh = useCallback(() => {
    /* no-op while ash overlay is disabled */
  }, []);

  return {
    ashThread,
    clearAsh,
    reduceMotion: Boolean(reduceMotion),
  };
}
