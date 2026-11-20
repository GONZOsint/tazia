import { useEffect, useState } from 'react';
import type { ThreadGroup } from './types';

/**
 * Selection + compose + search. When the selected id is missing from the
 * (filtered) thread list, clear selection so highlight and reader stay aligned.
 */
export function useForumThreadSelection(threads: ThreadGroup[], roomId: string) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isComposingThread, setIsComposingThread] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [topicsOpen, setTopicsOpen] = useState(false);

  useEffect(() => {
    setSelectedThreadId(null);
    setIsComposingThread(false);
    setSearchQuery('');
    setTopicsOpen(false);
  }, [roomId]);

  // Search/filter removed the selected thread — clear rather than ghost-show threads[0].
  useEffect(() => {
    if (!selectedThreadId) return;
    if (threads.some((th) => th.threadId === selectedThreadId)) return;
    setSelectedThreadId(null);
  }, [threads, selectedThreadId]);

  const selectThread = (threadId: string) => {
    setIsComposingThread(false);
    setSelectedThreadId(threadId);
    setTopicsOpen(false);
  };

  const startCompose = () => {
    setIsComposingThread(true);
    setTopicsOpen(false);
  };

  return {
    selectedThreadId,
    setSelectedThreadId,
    isComposingThread,
    setIsComposingThread,
    searchQuery,
    setSearchQuery,
    topicsOpen,
    setTopicsOpen,
    selectThread,
    startCompose,
  };
}
