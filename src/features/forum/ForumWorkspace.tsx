import { useMemo, useState } from 'react';
import { List, MessageSquare, MessageSquarePlus } from 'lucide-react';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { AnimatePresence, motion } from 'motion/react';
import type { LocalProfile } from '../../core/crypto/identity';
import { useT } from '../../i18n';
import type { ForumMessage, MeshStatus } from '../../core/protocol';
import { DUR, EASE, TAP, TAP_TRANSITION } from '../../motion/tokens';
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
    <main className="card-container mx-auto flex max-w-[1280px] flex-col px-4 pt-2 sm:px-8 sm:pt-4 lg:min-h-0 lg:py-5">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3 lg:hidden">
        <motion.button
          whileTap={TAP}
          transition={TAP_TRANSITION}
          type="button"
          onClick={() => setTopicsOpen(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-ctrl)] border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-ink hover:bg-bg focus-visible:outline-2 focus-visible:outline-accent"
        >
          <List className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
          {t('sidebarTopics')}
        </motion.button>
        <motion.button
          whileTap={TAP}
          transition={TAP_TRANSITION}
          type="button"
          onClick={() => setIsComposingThread(true)}
          className="btn-accent-sheen inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-3 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
          {t('sidebarNewThread')}
        </motion.button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-stretch">
        <div className="hidden lg:block">
          <RoomSidebar {...sidebarProps} />
        </div>

        <AnimatePresence initial={false}>
          {topicsOpen && (
            <motion.button
              key="topics-scrim"
              type="button"
              className="fixed inset-0 z-50 bg-scrim lg:hidden"
              aria-label={t('sidebarCloseTopics')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DUR.tab }}
              onClick={() => setTopicsOpen(false)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {topicsOpen && (
            <motion.div
              key="topics-panel"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={EASE.spring}
              className="shadow-sheet fixed inset-y-0 left-0 z-50 w-[min(100%,360px)] overflow-y-auto border-r border-border bg-bg p-4 lg:hidden"
              style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
            >
              <RoomSidebar {...sidebarProps} mobileSheet onCloseSheet={() => setTopicsOpen(false)} />
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
                    className="min-h-[44px] shrink-0 rounded-[var(--radius-ctrl)] px-2 text-xs font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    onClick={onDismissRoomError}
                  >
                    {t('dismissAlert')}
                  </button>
                )}
              </div>
            </AlertBanner>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {isComposingThread ? (
              <motion.div
                key="composer"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: DUR.tab, ease: EASE.outExpo }}
                className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0"
              >
                <ThreadComposer
                  identity={profile}
                  isBusy={isBusy}
                  onCancel={() => setIsComposingThread(false)}
                  onSubmitThread={onCreateThread}
                />
              </motion.div>
            ) : (
              <motion.div
                key={activeThread?.threadId ?? 'idle'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: DUR.tab, ease: EASE.outExpo }}
              >
                {isSyncing && messages.length === 0 ? (
                  <div className="space-y-4" aria-busy="true" aria-label={t('forumSyncing')}>
                    <div className="panel-surface h-32 animate-pulse" />
                    <div className="panel-surface h-24 animate-pulse" />
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
                  <div className="panel-surface p-8 text-center sm:p-10">
                    <MessageSquare className="mx-auto h-12 w-12 text-faint" aria-hidden="true" strokeWidth={1.5} />
                    <h2 className="mt-4 font-display text-lg font-semibold text-ink">
                      {hasAnyThreads && searchQuery.trim() ? t('forumNoResults') : t('forumEmptyThreads')}
                    </h2>
                    {hasAnyThreads && searchQuery.trim() ? (
                      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                        {t('forumNoResultsHint', { q: searchQuery.trim() })}
                      </p>
                    ) : null}
                    {!(hasAnyThreads && searchQuery.trim()) && (
                      <motion.button
                        whileTap={TAP}
                        transition={TAP_TRANSITION}
                        type="button"
                        onClick={() => setIsComposingThread(true)}
                        aria-label={t('forumStartFirst')}
                        className="btn-accent-sheen mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <MessageSquarePlus className="h-5 w-5" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">{t('forumStartFirst')}</span>
                      </motion.button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </main>
  );
}

export default ForumWorkspace;
