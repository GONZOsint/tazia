import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ForumMessage } from '../../core/protocol';

type EnterSets = {
  freshIds: ReadonlySet<string>;
  fromSendIds: ReadonlySet<string>;
  firstContentIds: ReadonlySet<string>;
};

const EMPTY: EnterSets = {
  freshIds: new Set(),
  fromSendIds: new Set(),
  firstContentIds: new Set(),
};

/**
 * Tracks which post ids should animate enter / fromSend / firstContent.
 * Updates in useLayoutEffect (not useMemo) so Strict Mode / concurrent renders stay sane.
 */
export function usePostEnterAnimation(
  threadId: string,
  posts: ForumMessage[],
  repliesLength: number,
  selfUserId: string
) {
  const [enterReady, setEnterReady] = useState(false);
  const [sets, setSets] = useState<EnterSets>(EMPTY);

  const knownIdsRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  const pendingSendLandsRef = useRef(0);
  const wasEmptyRef = useRef(false);
  const fromSendAccRef = useRef<Set<string>>(new Set());
  const firstContentAccRef = useRef<Set<string>>(new Set());
  const threadIdRef = useRef(threadId);

  useEffect(() => {
    setEnterReady(true);
  }, []);

  useLayoutEffect(() => {
    if (threadIdRef.current !== threadId) {
      threadIdRef.current = threadId;
      knownIdsRef.current = new Set();
      seededRef.current = false;
      pendingSendLandsRef.current = 0;
      wasEmptyRef.current = false;
      fromSendAccRef.current = new Set();
      firstContentAccRef.current = new Set();
      setSets(EMPTY);
    }

    if (!seededRef.current) {
      knownIdsRef.current = new Set(posts.map((p) => p.msgId));
      seededRef.current = true;
      wasEmptyRef.current = repliesLength === 0;
      return;
    }

    const fresh = new Set<string>();
    for (const m of posts) {
      if (knownIdsRef.current.has(m.msgId)) continue;
      fresh.add(m.msgId);
      knownIdsRef.current.add(m.msgId);

      if (wasEmptyRef.current && firstContentAccRef.current.size === 0) {
        firstContentAccRef.current.add(m.msgId);
        wasEmptyRef.current = false;
      }
      if (
        m.authorUserId === selfUserId &&
        pendingSendLandsRef.current > 0 &&
        !fromSendAccRef.current.has(m.msgId)
      ) {
        fromSendAccRef.current.add(m.msgId);
        pendingSendLandsRef.current -= 1;
      }
    }

    // Always publish sets so `freshIds` clears after the landing frame.
    setSets({
      freshIds: fresh,
      fromSendIds: new Set(fromSendAccRef.current),
      firstContentIds: new Set(firstContentAccRef.current),
    });
  }, [posts, repliesLength, selfUserId, threadId]);

  const notePendingSend = useCallback(() => {
    pendingSendLandsRef.current += 1;
  }, []);

  const cancelPendingSend = useCallback(() => {
    pendingSendLandsRef.current = Math.max(0, pendingSendLandsRef.current - 1);
  }, []);

  return {
    enterReady,
    freshIds: sets.freshIds,
    fromSendIds: sets.fromSendIds,
    firstContentIds: sets.firstContentIds,
    notePendingSend,
    cancelPendingSend,
  };
}
