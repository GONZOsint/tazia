import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List, MessageSquare, MessageSquarePlus } from 'lucide-react';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { TalkAshOverlay } from '../../components/session/TalkAshOverlay';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { LocalProfile } from '../../core/crypto/identity';
import {
  collectDeleteBallots,
  deletedThreadIds,
  isContentForumType,
  openBallotForThread,
} from '../../core/forum/threadDelete';
import { useT } from '../../i18n';
import type { ForumMessage, MeshStatus } from '../../core/protocol';
import { haptic, HAPTIC_RITUAL } from '../../motion/haptic';
import {
  TAP,
  TAP_TRANSITION,
  TALK_ASH,
  drawerPanel,
  enterPlaza,
  modalScrim,
} from '../../motion/tokens';
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
  onlineUserIds: string[];
  onlineCount: number;
  meshStatus: MeshStatus;
  relayActive?: boolean;
  isPublishing: boolean;
  isSyncing: boolean;
  roomError: string | null;
  roomErrorTone?: 'error' | 'warning' | 'info' | 'success';
  onDismissRoomError?: () => void;
  onSyncNow: () => Promise<void>;
  onCreateThread: (title: string, body: string) => Promise<boolean>;
  onReplyThread: (threadId: string, parentMsgId: string, body: string) => Promise<boolean>;
  onProposeDeleteThread: (threadId: string, electorate: string[]) => Promise<boolean>;
  onVoteDeleteThread: (threadId: string, proposalMsgId: string) => Promise<boolean>;
}

export function ForumWorkspace({
  roomId,
  phrase,
  profile,
  selfUserId,
  messages,
  presenceAliases,
  onlineUserIds,
  onlineCount,
  meshStatus,
  relayActive = false,
  isPublishing,
  isSyncing,
  roomError,
  roomErrorTone = 'error',
  onDismissRoomError,
  onSyncNow,
  onCreateThread,
  onReplyThread,
  onProposeDeleteThread,
  onVoteDeleteThread,
}: ForumWorkspaceProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isComposingThread, setIsComposingThread] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authorVisuals, setAuthorVisuals] = useState<AuthorVisualCache>({});
  const [topicsOpen, setTopicsOpen] = useState(false);
  /** Snapshot while the talk ash exit plays after unanimous delete (all peers). */
  const [ashThread, setAshThread] = useState<ThreadGroup | null>(null);
  const threadSnapshotsRef = useRef<Map<string, ThreadGroup>>(new Map());
  const ashPlayedRef = useRef<Set<string>>(new Set());

  /** Zone switch without remount — clear local UI so Plaza does not keep the previous room's thread/composer. */
  useEffect(() => {
    setSelectedThreadId(null);
    setIsComposingThread(false);
    setSearchQuery('');
    setAuthorVisuals({});
    setTopicsOpen(false);
    setAshThread(null);
    threadSnapshotsRef.current = new Map();
    ashPlayedRef.current = new Set();
  }, [roomId]);

  const deletedIds = useMemo(() => deletedThreadIds(messages), [messages]);

  const pendingDeleteIds = useMemo(() => {
    const ids = new Set<string>();
    for (const b of collectDeleteBallots(messages)) {
      if (!b.complete) ids.add(b.threadId);
    }
    return ids;
  }, [messages]);

  const threads = useMemo<ThreadGroup[]>(() => {
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
  }, [messages, deletedIds, searchQuery, t]);

  const hasAnyThreads = messages.some(
    (m) => isContentForumType(m.type) && !deletedIds.has(m.threadId)
  );

  const activeThread = useMemo(() => {
    if (threads.length === 0) return null;
    if (selectedThreadId) {
      const found = threads.find((th) => th.threadId === selectedThreadId);
      if (found) return found;
    }
    return threads[0];
  }, [threads, selectedThreadId]);

  const activeDeleteBallot = useMemo(() => {
    if (!activeThread) return null;
    return openBallotForThread(messages, activeThread.threadId);
  }, [messages, activeThread]);

  useEffect(() => {
    for (const th of threads) {
      threadSnapshotsRef.current.set(th.threadId, th);
    }
  }, [threads]);

  useEffect(() => {
    if (selectedThreadId && deletedIds.has(selectedThreadId) && !ashThread) {
      setSelectedThreadId(null);
    }
  }, [deletedIds, selectedThreadId, ashThread]);

  useEffect(() => {
    if (ashThread) return;
    for (const id of deletedIds) {
      if (ashPlayedRef.current.has(id)) continue;
      const snap = threadSnapshotsRef.current.get(id);
      ashPlayedRef.current.add(id);
      if (!snap) continue;
      setAshThread(snap);
      setIsComposingThread(false);
      setSelectedThreadId(id);
      haptic(HAPTIC_RITUAL);
      break;
    }
  }, [deletedIds, ashThread]);

  const clearAsh = useCallback(() => {
    setAshThread(null);
    setSelectedThreadId(null);
  }, []);

  useEffect(() => {
    if (!ashThread) return;
    const ms = (reduceMotion ? TALK_ASH.reducedMs : TALK_ASH.durationMs) + 320;
    const timer = window.setTimeout(clearAsh, ms);
    return () => window.clearTimeout(timer);
  }, [ashThread, reduceMotion, clearAsh]);

  const isBusy = isPublishing;
  const displayThread = ashThread ?? activeThread;
  const displayBallot = ashThread ? null : activeDeleteBallot;

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
    relayActive,
    isSyncing,
    isBusy: isBusy || Boolean(ashThread),
    onSyncNow: () => void onSyncNow(),
    pendingDeleteIds,
    ashThread,
    reduceMotion: Boolean(reduceMotion),
  };

  return (
    <main className="card-container mx-auto flex h-full min-h-0 w-full max-w-[1280px] flex-col overflow-hidden px-4 pt-2 sm:px-8 sm:pt-4 lg:py-5">
      <TalkAshOverlay play={Boolean(ashThread)} onComplete={clearAsh} />
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3 lg:hidden">
        <motion.button
          whileTap={TAP}
          transition={TAP_TRANSITION}
          type="button"
          onClick={() => setTopicsOpen(true)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-ctrl)] border border-border bg-surface-raised px-3 py-2 type-ui font-semibold text-ink hover:bg-bg focus-visible:outline-2 focus-visible:outline-accent"
        >
          <List className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
          {t('sidebarTopics')}
        </motion.button>
        <motion.button
          whileTap={TAP}
          transition={TAP_TRANSITION}
          type="button"
          onClick={() => setIsComposingThread(true)}
          className="btn-accent-sheen inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-3 py-2 type-ui font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
          {t('sidebarNewThread')}
        </motion.button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-stretch lg:gap-5">
        <div className="hidden min-h-0 lg:block lg:overflow-y-auto">
          <RoomSidebar {...sidebarProps} />
        </div>

        <AnimatePresence initial={false}>
          {topicsOpen && (
            <motion.button
              key="topics-scrim"
              type="button"
              className="fixed inset-0 z-50 bg-scrim lg:hidden"
              aria-label={t('sidebarCloseTopics')}
              initial={modalScrim.initial}
              animate={modalScrim.animate}
              exit={modalScrim.exit}
              transition={modalScrim.transition}
              onClick={() => setTopicsOpen(false)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {topicsOpen && (
            <motion.div
              key="topics-panel"
              initial={drawerPanel.initial}
              animate={drawerPanel.animate}
              exit={drawerPanel.exit}
              transition={drawerPanel.transition}
              className="shadow-sheet fixed inset-y-0 left-0 z-50 w-[min(100%,360px)] overflow-y-auto border-r border-border bg-bg p-4 lg:hidden"
              style={{
                paddingTop: 'max(1rem, env(safe-area-inset-top))',
                paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
              }}
            >
              <RoomSidebar {...sidebarProps} mobileSheet onCloseSheet={() => setTopicsOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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

          <div className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            {isComposingThread ? (
              <motion.div
                key="composer"
                initial={enterPlaza.initial}
                animate={enterPlaza.animate}
                exit={enterPlaza.exit}
                transition={enterPlaza.transition}
                className="absolute inset-0 overflow-y-auto"
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
                key={displayThread?.threadId ?? ashThread?.threadId ?? 'idle'}
                initial={ashThread ? false : enterPlaza.initial}
                animate={enterPlaza.animate}
                exit={enterPlaza.exit}
                transition={enterPlaza.transition}
                className={`absolute inset-0 flex flex-col overflow-hidden ${
                  ashThread
                    ? `plaza-talk-ash-target ${
                        reduceMotion
                          ? 'plaza-talk-incinerate plaza-talk-incinerate--reduced'
                          : 'plaza-talk-incinerate'
                      }`
                    : ''
                }`}
                aria-busy={ashThread ? true : undefined}
                aria-label={ashThread ? t('readerDeleteIncinerating') : undefined}
              >
                {isSyncing && messages.length === 0 && !ashThread ? (
                  <div className="space-y-4" aria-busy="true" aria-label={t('forumSyncing')}>
                    <div className="panel-surface h-32 animate-pulse" />
                    <div className="panel-surface h-24 animate-pulse" />
                  </div>
                ) : displayThread ? (
                  <ThreadReader
                    thread={displayThread}
                    identity={profile}
                    selfUserId={selfUserId}
                    presenceAliases={presenceAliases}
                    authorVisuals={authorVisuals}
                    onAuthorVisuals={setAuthorVisuals}
                    onlineUserIds={onlineUserIds}
                    deleteBallot={displayBallot}
                    isBusy={isBusy || Boolean(ashThread)}
                    onReplyThread={onReplyThread}
                    onProposeDeleteThread={onProposeDeleteThread}
                    onVoteDeleteThread={onVoteDeleteThread}
                  />
                ) : (
                  <div className="panel-surface px-6 py-10 text-center sm:px-8 sm:py-12">
                    <MessageSquare className="mx-auto h-12 w-12 text-faint" aria-hidden="true" strokeWidth={1.5} />
                    <h2 className="type-title mt-4 text-ink">
                      {hasAnyThreads && searchQuery.trim() ? t('forumNoResults') : t('forumEmptyThreads')}
                    </h2>
                    {hasAnyThreads && searchQuery.trim() ? (
                      <p className="type-lede mx-auto mt-2 max-w-md">
                        {t('forumNoResultsHint', { q: searchQuery.trim() })}
                      </p>
                    ) : (
                      <p className="type-lede mx-auto mt-2 max-w-md">
                        {t('forumEmptyHint')}
                      </p>
                    )}
                    {!(hasAnyThreads && searchQuery.trim()) && (
                      <motion.button
                        whileTap={TAP}
                        transition={TAP_TRANSITION}
                        type="button"
                        onClick={() => setIsComposingThread(true)}
                        className="btn-accent-sheen mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-5 py-2.5 type-ui font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <MessageSquarePlus className="h-5 w-5" aria-hidden="true" />
                        {t('forumStartFirst')}
                      </motion.button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </section>
      </div>
    </main>
  );
}

export default ForumWorkspace;
