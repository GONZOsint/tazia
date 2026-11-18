import { useMemo, useState } from 'react';
import { List, MessageSquare, MessageSquarePlus } from 'lucide-react';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { AnimatePresence, motion } from 'motion/react';
import type { LocalProfile } from '../../core/crypto/identity';
import { useT } from '../../i18n';
import type { ForumMessage, MeshStatus } from '../../core/protocol';
import { RoomSidebar, type ThreadGroup } from './RoomSidebar';
import { ThreadComposer } from './ThreadComposer';
import { ThreadReader, type AuthorVisualCache } from './ThreadReader';

interface ForumWorkspaceProps {
  roomId: string;
  phrase: string | null;
  profile: LocalProfile;
  selfUserId: string;
  messages: ForumMessage[];
  presenceAliases: Record<string, string>;
  onlineCount: number;
  meshStatus: MeshStatus;
  isPublishing: boolean;
  isSyncing: boolean;
  roomError: string | null;
  roomErrorTone?: 'error' | 'warning' | 'info' | 'success';
  onDismissRoomError?: () => void;
  onSyncNow: () => Promise<void>;
  onCreateThread: (title: string, body: string) => Promise<boolean>;
  onReplyThread: (threadId: string, parentMsgId: string, body: string) => Promise<boolean>;
}

export function ForumWorkspace({
  roomId,
  phrase,
  profile,
  selfUserId,
  messages,
  presenceAliases,
  onlineCount,
  meshStatus,
  isPublishing,
  isSyncing,
  roomError,
  roomErrorTone = 'error',
  onDismissRoomError,
  onSyncNow,
  onCreateThread,
  onReplyThread,
}: ForumWorkspaceProps) {
  const t = useT();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isComposingThread, setIsComposingThread] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authorVisuals, setAuthorVisuals] = useState<AuthorVisualCache>({});
  const [topicsOpen, setTopicsOpen] = useState(false);

  const threads = useMemo<ThreadGroup[]>(() => {
    const map = new Map<string, ForumMessage[]>();
    for (const msg of messages) {
      const arr = map.get(msg.threadId) ?? [];
      arr.push(msg);
      map.set(msg.threadId, arr);
    }

    const groups: ThreadGroup[] = [];
    for (const [threadId, list] of map.entries()) {
      const sorted = [...list].sort((a, b) => a.createdAtMs - b.createdAtMs);
      const root = sorted.find((m) => m.type === 'NEW_THREAD') ?? sorted[0];
      const replies = sorted.filter((m) => m.msgId !== root.msgId);
      groups.push({
        threadId,
        title: root.title || t('readerUntitled'),
        rootPost: root,
        replies,
        lastActivityMs: sorted[sorted.length - 1].createdAtMs,
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
  }, [messages, searchQuery, t]);

  const hasAnyThreads = messages.length > 0;

  const activeThread = useMemo(() => {
    if (threads.length === 0) return null;
    if (selectedThreadId) {
      const found = threads.find((th) => th.threadId === selectedThreadId);
      if (found) return found;
    }
    return threads[0];
  }, [threads, selectedThreadId]);

  const isBusy = isPublishing;

  const sidebarProps = {
    roomId,
    phrase,
    profile,
    selfUserId,
    threads,
    hasAnyThreads,
    activeThreadId: activeThread?.threadId ?? null,
    isComposingThread,
    searchQuery,
    onSearchChange: setSearchQuery,
    onSelectThread: (threadId: string) => {
      setIsComposingThread(false);
      setSelectedThreadId(threadId);
      setTopicsOpen(false);
    },
    onStartCompose: () => {
      setIsComposingThread(true);
      setTopicsOpen(false);
    },
    onlineCount,
    meshStatus,
    isSyncing,
    isBusy,
    onSyncNow: () => void onSyncNow(),
  };

  return (
    <main className="card-container mx-auto flex max-w-[1280px] flex-col px-4 pt-3 sm:px-8 sm:pt-6 lg:min-h-0 lg:py-8">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setTopicsOpen(true)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-ink"
        >
          <List className="h-4 w-4" aria-hidden="true" />
          {t('sidebarTopics')}
        </button>
        <button
          type="button"
          onClick={() => setIsComposingThread(true)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-on-accent"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          {t('sidebarNewThread')}
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-stretch">
        <div className="hidden lg:block">
          <RoomSidebar {...sidebarProps} />
        </div>

        <AnimatePresence>
          {topicsOpen && (
            <motion.div
              className="fixed inset-0 z-50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/50"
                aria-label={t('sidebarCloseTopics')}
                onClick={() => setTopicsOpen(false)}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="absolute inset-y-0 left-0 w-[min(100%,360px)] overflow-y-auto bg-bg p-4 shadow-xl"
                style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
              >
                <RoomSidebar {...sidebarProps} mobileSheet onCloseSheet={() => setTopicsOpen(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {roomError && (
            <AlertBanner tone={roomErrorTone} role="status" className="mb-3 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <span>{roomError}</span>
                {onDismissRoomError && (
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline"
                    onClick={onDismissRoomError}
                  >
                    {t('dismissAlert')}
                  </button>
                )}
              </div>
            </AlertBanner>
          )}

          {isComposingThread ? (
            <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
              <ThreadComposer
                identity={profile}
                isBusy={isBusy}
                onCancel={() => setIsComposingThread(false)}
                onSubmitThread={onCreateThread}
              />
            </div>
          ) : isSyncing && messages.length === 0 ? (
            <div className="space-y-4" aria-busy="true" aria-label={t('forumSyncing')}>
              <div className="h-32 animate-pulse rounded-2xl border border-border bg-surface-raised" />
              <div className="h-24 animate-pulse rounded-2xl border border-border bg-surface-raised" />
            </div>
          ) : activeThread ? (
            <ThreadReader
              thread={activeThread}
              identity={profile}
              selfUserId={selfUserId}
              presenceAliases={presenceAliases}
              authorVisuals={authorVisuals}
              onAuthorVisuals={setAuthorVisuals}
              isBusy={isBusy}
              onReplyThread={onReplyThread}
            />
          ) : (
            <div className="rounded-2xl border border-border bg-surface-raised p-8 text-center sm:p-10">
              <MessageSquare className="mx-auto h-9 w-9 text-faint" aria-hidden="true" strokeWidth={1.5} />
              <h2 className="mt-4 font-display text-lg font-semibold text-ink">
                {hasAnyThreads && searchQuery.trim() ? t('forumNoResults') : t('forumEmptyThreads')}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                {hasAnyThreads && searchQuery.trim()
                  ? t('forumNoResultsHint', { q: searchQuery.trim() })
                  : t('forumEmptyHint')}
              </p>
              {!(hasAnyThreads && searchQuery.trim()) && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setIsComposingThread(true)}
                  className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent"
                >
                  <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
                  {t('forumStartFirst')}
                </motion.button>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default ForumWorkspace;
