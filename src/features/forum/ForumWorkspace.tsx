import { useMemo, useState } from 'react';
import { List, MessageSquarePlus } from 'lucide-react';
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
  transportNotice?: string | null;
  onDismissRoomError?: () => void;
  onDismissTransportNotice?: () => void;
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
  transportNotice = null,
  onDismissRoomError,
  onDismissTransportNotice,
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
    <main className="card-container mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setTopicsOpen(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-ink"
        >
          <List className="h-4 w-4" aria-hidden="true" />
          {t('sidebarTopics')}
        </button>
        <button
          type="button"
          onClick={() => setIsComposingThread(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          {t('sidebarNewThread')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
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

        <section className="min-w-0">
          {transportNotice && (
            <AlertBanner tone="warning" role="status" className="mb-3">
              <div className="flex items-start justify-between gap-3">
                <span>{transportNotice}</span>
                {onDismissTransportNotice && (
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline"
                    onClick={onDismissTransportNotice}
                  >
                    {t('dismissAlert')}
                  </button>
                )}
              </div>
            </AlertBanner>
          )}

          {roomError && (
            <AlertBanner tone={roomErrorTone} role="status" className="mb-5">
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
            <ThreadComposer
              identity={profile}
              isBusy={isBusy}
              onCancel={() => setIsComposingThread(false)}
              onSubmitThread={onCreateThread}
            />
          ) : isSyncing && messages.length === 0 ? (
            <div className="space-y-6" aria-busy="true" aria-label={t('forumSyncing')}>
              <div className="h-48 animate-pulse rounded-2xl border border-border bg-surface-raised" />
              <div className="h-36 animate-pulse rounded-2xl border border-border bg-surface-raised" />
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
            <div className="rounded-2xl border border-border bg-surface-raised p-10 text-center sm:p-12">
              <h2 className="font-display text-lg font-semibold text-ink">
                {hasAnyThreads && searchQuery.trim() ? t('forumNoResults') : t('forumEmptyThreads')}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
                {hasAnyThreads && searchQuery.trim()
                  ? t('forumNoResultsHint', { q: searchQuery.trim() })
                  : t('forumEmptyHint')}
              </p>
              {!(hasAnyThreads && searchQuery.trim()) && (
                <motion.button
                  whileTap={{ scale: 0.985 }}
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
