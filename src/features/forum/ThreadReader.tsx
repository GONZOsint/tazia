import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CornerDownRight, Flame, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  visualFromUserId,
  type LocalProfile,
  type PeerVisual,
} from '../../core/crypto/identity';
import type { ThreadDeleteBallot } from '../../core/forum/threadDelete';
import { useLocale, useT } from '../../i18n';
import { MAX_BODY_CHARS, type ForumMessage } from '../../core/protocol';
import { formatClockTime } from '../../core/utils/inviteLink';
import { Identicon } from '../../components/content/Identicon';
import { SafeMessageBody } from '../../components/content/SafeMessageBody';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PlaneSendIcon } from '../../components/ui/PlaneSendIcon';
import { usePlaneLaunch } from '../../hooks/usePlaneLaunch';
import { haptic, HAPTIC_TAP } from '../../motion/haptic';
import {
  TAP,
  TAP_TRANSITION,
  disclosure,
  postOrigin,
  resolveBubbleEnter,
} from '../../motion/tokens';
import type { ThreadGroup } from './RoomSidebar';

export type AuthorVisualCache = Record<string, PeerVisual>;

interface ThreadReaderProps {
  thread: ThreadGroup;
  identity: LocalProfile;
  selfUserId: string;
  presenceAliases: Record<string, string>;
  authorVisuals: AuthorVisualCache;
  onAuthorVisuals: (next: AuthorVisualCache) => void;
  onlineUserIds: string[];
  deleteBallot: ThreadDeleteBallot | null;
  isBusy: boolean;
  onReplyThread: (threadId: string, parentMsgId: string, body: string) => Promise<boolean>;
  onProposeDeleteThread: (threadId: string, electorate: string[]) => Promise<boolean>;
  onVoteDeleteThread: (threadId: string, proposalMsgId: string) => Promise<boolean>;
}

type TreeNode = {
  message: ForumMessage;
  children: TreeNode[];
};

const MAX_DEPTH = 4;
const INDENT_PX = 18;

function buildTree(root: ForumMessage, replies: ForumMessage[]): TreeNode {
  const byParent = new Map<string, ForumMessage[]>();
  for (const r of replies) {
    const pid = r.parentMsgId || root.msgId;
    const list = byParent.get(pid) ?? [];
    list.push(r);
    byParent.set(pid, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.createdAtMs - b.createdAtMs);
  }

  const walk = (msg: ForumMessage, depth: number): TreeNode => {
    const kids = byParent.get(msg.msgId) ?? [];
    if (depth >= MAX_DEPTH) {
      const flat: ForumMessage[] = [];
      const collect = (id: string) => {
        for (const c of byParent.get(id) ?? []) {
          flat.push(c);
          collect(c.msgId);
        }
      };
      collect(msg.msgId);
      flat.sort((a, b) => a.createdAtMs - b.createdAtMs);
      return {
        message: msg,
        children: flat.map((m) => ({ message: m, children: [] })),
      };
    }
    return {
      message: msg,
      children: kids.map((c) => walk(c, depth + 1)),
    };
  };

  return walk(root, 0);
}

function snippetOf(text: string, max = 56): string {
  const one = text.replace(/\s+/g, ' ').trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max - 1)}…`;
}

function PostCard({
  message,
  alias,
  visual,
  isSelf,
  depth,
  parentAlias,
  parentSnippet,
  highlighted,
  onReply,
  youSuffix,
  replyLabel,
  locale,
  animateEnter,
  fromSend,
  firstContent,
  reduceMotion,
}: {
  message: ForumMessage;
  alias: string;
  visual?: PeerVisual;
  isSelf: boolean;
  depth: number;
  parentAlias: string | null;
  parentSnippet: string | null;
  highlighted: boolean;
  onReply: () => void;
  youSuffix: string;
  replyLabel: string;
  locale: string;
  /** False on first paint of a thread — avoids cascade flicker. */
  animateEnter: boolean;
  fromSend?: boolean;
  firstContent?: boolean;
  reduceMotion: boolean | null;
}) {
  const nested = depth > 0;
  const enter = resolveBubbleEnter(reduceMotion, { fromSend, firstContent });
  return (
    <motion.article
      layout={false}
      initial={animateEnter ? enter.initial : false}
      animate={enter.animate}
      transition={enter.transition}
      style={postOrigin}
      className={`plaza-post ${nested ? 'plaza-post--nested' : ''} ${
        isSelf ? 'plaza-post--self' : ''
      } ${highlighted ? 'is-highlighted' : ''}`}
    >
      <header className="flex items-center gap-2">
        {visual ? (
          <Identicon
            matrix={visual.identiconMatrix}
            size={22}
            label={alias}
            fg={visual.fg}
            bg={visual.bg}
          />
        ) : (
          <div className="h-[22px] w-[22px] rounded-[var(--radius-ctrl)] bg-surface" />
        )}
        <p className="type-ui min-w-0 flex-1 truncate font-semibold text-ink">
          {alias}
          {isSelf ? youSuffix : ''}
          <span className="type-caption ml-1.5 font-normal">
            {formatClockTime(message.createdAtMs, locale)}
          </span>
        </p>
        <motion.button
          whileTap={TAP}
          transition={TAP_TRANSITION}
          type="button"
          onClick={onReply}
          aria-label={replyLabel}
          title={replyLabel}
          className="icon-action text-ink/75 hover:bg-bg hover:text-ink"
        >
          <CornerDownRight className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
        </motion.button>
      </header>

      {parentSnippet && (
        <div className="thread-quote">
          <span className="min-w-0 truncate">
            {parentAlias ? (
              <span className="font-semibold text-ink/80">{parentAlias}</span>
            ) : null}
            {parentAlias ? ' · ' : ''}
            {parentSnippet}
          </span>
        </div>
      )}

      <div className="type-message mt-1.5">
        <SafeMessageBody text={message.body} />
      </div>
    </motion.article>
  );
}

export function ThreadReader({
  thread,
  identity,
  selfUserId,
  presenceAliases,
  authorVisuals,
  onAuthorVisuals,
  onlineUserIds,
  deleteBallot,
  isBusy,
  onReplyThread,
  onProposeDeleteThread,
  onVoteDeleteThread,
}: ThreadReaderProps) {
  const t = useT();
  const { locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const [replyBody, setReplyBody] = useState('');
  const [replyParent, setReplyParent] = useState<ForumMessage | null>(null);
  const { planeKey, launching: planeLaunching, trigger: triggerPlane } = usePlaneLaunch();
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  /** After first paint, new posts may land with bubbleEnter. */
  const enterReadyRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  const fromSendIdsRef = useRef<Set<string>>(new Set());
  const pendingSendLandsRef = useRef(0);
  const firstContentIdsRef = useRef<Set<string>>(new Set());
  const wasEmptyRef = useRef(false);
  useEffect(() => {
    enterReadyRef.current = true;
  }, []);

  // New thread → reseed before freshIds memo (same render as thread switch).
  const threadIdTracked = useRef(thread.threadId);
  if (threadIdTracked.current !== thread.threadId) {
    threadIdTracked.current = thread.threadId;
    knownIdsRef.current = new Set();
    seededRef.current = false;
    fromSendIdsRef.current = new Set();
    pendingSendLandsRef.current = 0;
    firstContentIdsRef.current = new Set();
    wasEmptyRef.current = false;
  }

  const posts = useMemo(
    () => [thread.rootPost, ...thread.replies],
    [thread.rootPost, thread.replies]
  );

  const freshIds = useMemo(() => {
    const fresh = new Set<string>();
    if (!seededRef.current) return fresh;
    for (const m of posts) {
      if (knownIdsRef.current.has(m.msgId)) continue;
      fresh.add(m.msgId);
      if (wasEmptyRef.current && firstContentIdsRef.current.size === 0) {
        firstContentIdsRef.current.add(m.msgId);
        wasEmptyRef.current = false;
      }
      if (
        m.authorUserId === selfUserId &&
        pendingSendLandsRef.current > 0 &&
        !fromSendIdsRef.current.has(m.msgId)
      ) {
        fromSendIdsRef.current.add(m.msgId);
        pendingSendLandsRef.current -= 1;
      }
    }
    return fresh;
  }, [posts, selfUserId]);

  useLayoutEffect(() => {
    if (!seededRef.current) {
      knownIdsRef.current = new Set(posts.map((p) => p.msgId));
      seededRef.current = true;
      // Root always exists; “empty” = no replies yet beyond root.
      wasEmptyRef.current = thread.replies.length === 0;
      return;
    }
    for (const p of posts) knownIdsRef.current.add(p.msgId);
  }, [posts, thread.replies.length]);

  const tree = useMemo(
    () => buildTree(thread.rootPost, thread.replies),
    [thread.rootPost, thread.replies]
  );

  const byId = useMemo(() => {
    const m = new Map<string, ForumMessage>();
    for (const p of posts) m.set(p.msgId, p);
    return m;
  }, [posts]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = { ...authorVisuals };
      let changed = false;
      for (const post of posts) {
        if (next[post.authorUserId]) continue;
        next[post.authorUserId] = await visualFromUserId(post.authorUserId);
        changed = true;
      }
      if (!cancelled && changed) onAuthorVisuals(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [posts, authorVisuals, onAuthorVisuals]);

  useEffect(() => {
    if (!highlightId) return;
    const tmr = window.setTimeout(() => setHighlightId(null), 400);
    return () => window.clearTimeout(tmr);
  }, [highlightId]);

  const resolveAlias = (userId: string) =>
    presenceAliases[userId] ||
    (userId === selfUserId ? identity.alias : undefined) ||
    authorVisuals[userId]?.suggestedAlias ||
    t('presenceNoAlias');

  const handleReplyClick = (msg: ForumMessage) => {
    setReplyParent(msg);
    setHighlightId(msg.msgId);
  };

  const selfIsElector = Boolean(
    deleteBallot && deleteBallot.electorate.includes(selfUserId)
  );
  const selfHasVoted = Boolean(
    deleteBallot && deleteBallot.votes.includes(selfUserId)
  );

  const waitingNames = useMemo(() => {
    if (!deleteBallot) return '';
    const pending = deleteBallot.electorate.filter((id) => !deleteBallot.votes.includes(id));
    return pending
      .map(
        (id) =>
          presenceAliases[id] ||
          (id === selfUserId ? identity.alias : undefined) ||
          authorVisuals[id]?.suggestedAlias ||
          t('presenceNoAlias')
      )
      .join(', ');
  }, [deleteBallot, presenceAliases, selfUserId, identity.alias, authorVisuals, t]);

  const handleProposeDelete = async () => {
    if (isBusy || deleteBusy || deleteBallot) return;
    setDeleteBusy(true);
    try {
      const electorate = [
        ...new Set([selfUserId, ...onlineUserIds.filter(Boolean)]),
      ];
      const ok = await onProposeDeleteThread(thread.threadId, electorate);
      if (ok) haptic(HAPTIC_TAP);
    } finally {
      setDeleteBusy(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleVoteDelete = async () => {
    if (!deleteBallot || isBusy || deleteBusy || selfHasVoted || !selfIsElector) return;
    setDeleteBusy(true);
    try {
      const ok = await onVoteDeleteThread(thread.threadId, deleteBallot.proposalMsgId);
      if (ok) haptic(HAPTIC_TAP);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() || isBusy || submitting) return;
    setSubmitting(true);
    triggerPlane();
    pendingSendLandsRef.current += 1;
    const parentId = replyParent ? replyParent.msgId : thread.rootPost.msgId;
    try {
      const ok = await onReplyThread(thread.threadId, parentId, replyBody.trim());
      if (ok) {
        haptic(HAPTIC_TAP);
        setReplyBody('');
        setReplyParent(null);
      } else {
        pendingSendLandsRef.current = Math.max(0, pendingSendLandsRef.current - 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderNode = (node: TreeNode, depth: number, isLast: boolean): React.ReactNode => {
    const msg = node.message;
    const parent =
      msg.parentMsgId && msg.msgId !== thread.rootPost.msgId
        ? byId.get(msg.parentMsgId) ?? null
        : null;
    const parentSnippet = parent && depth > 0 ? snippetOf(parent.body) : null;
    const parentAlias = parent && depth > 0 ? resolveAlias(parent.authorUserId) : null;
    const nested = depth > 0;

    return (
      <div
        key={msg.msgId}
        className={`thread-node space-y-1.5 ${nested ? 'thread-node--nested' : ''} ${
          nested && isLast && node.children.length === 0 ? 'is-last' : ''
        }`}
        style={
          nested && depth > 1
            ? { marginLeft: Math.min(depth - 1, MAX_DEPTH - 1) * INDENT_PX }
            : undefined
        }
      >
        <PostCard
          message={msg}
          alias={resolveAlias(msg.authorUserId)}
          visual={authorVisuals[msg.authorUserId]}
          isSelf={msg.authorUserId === selfUserId}
          depth={depth}
          parentAlias={parentAlias}
          parentSnippet={parentSnippet}
          highlighted={highlightId === msg.msgId}
          onReply={() => handleReplyClick(msg)}
          youSuffix={t('readerYou')}
          replyLabel={t('readerReply')}
          locale={locale}
          animateEnter={enterReadyRef.current}
          fromSend={
            enterReadyRef.current &&
            freshIds.has(msg.msgId) &&
            fromSendIdsRef.current.has(msg.msgId) &&
            !firstContentIdsRef.current.has(msg.msgId)
          }
          firstContent={
            enterReadyRef.current && firstContentIdsRef.current.has(msg.msgId)
          }
          reduceMotion={reduceMotion}
        />
        {node.children.map((child, i) =>
          renderNode(child, depth + 1, i === node.children.length - 1)
        )}
      </div>
    );
  };

  const replyAlias = replyParent ? resolveAlias(replyParent.authorUserId) : '';
  const replyLabel = replyParent ? t('readerReplyingTo', { alias: replyAlias }) : '';
  const replyAliasAt = replyAlias ? replyLabel.lastIndexOf(replyAlias) : -1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="plaza-title flex shrink-0 items-start justify-between gap-2">
        <h2 className="type-title min-w-0 flex-1 text-ink">
          {thread.title}
        </h2>
        {!deleteBallot && (
          <motion.button
            whileTap={TAP}
            transition={TAP_TRANSITION}
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={isBusy || deleteBusy}
            aria-label={t('readerDeleteTalk')}
            title={t('readerDeleteTalk')}
            className="icon-action icon-action--danger shrink-0 disabled:opacity-50"
          >
            <Flame className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
          </motion.button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {deleteBallot && (
          <motion.div
            key={deleteBallot.proposalMsgId}
            initial={disclosure.initial}
            animate={disclosure.animate}
            exit={disclosure.exit}
            transition={disclosure.transition}
            className="plaza-delete-ballot shrink-0 overflow-hidden"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2.5">
              <Flame
                className="plaza-delete-ballot__icon mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
                strokeWidth={2}
              />
              <div className="min-w-0 flex-1">
                <p className="plaza-delete-ballot__title text-sm font-semibold">
                  {t('readerDeleteVoteProgress', {
                    have: deleteBallot.votes.length,
                    need: deleteBallot.electorate.length,
                  })}
                </p>
                {waitingNames ? (
                  <p className="plaza-delete-ballot__meta type-caption mt-1">
                    {t('readerDeleteVoteWaiting', { names: waitingNames })}
                  </p>
                ) : null}
                {!selfIsElector ? (
                  <p className="plaza-delete-ballot__meta type-caption mt-1.5">
                    {t('readerDeleteVoteObserver')}
                  </p>
                ) : selfHasVoted ? (
                  <p className="plaza-delete-ballot__meta type-caption mt-1.5">
                    {t('readerDeleteVoteYouVoted')}
                  </p>
                ) : (
                  <motion.button
                    whileTap={TAP}
                    transition={TAP_TRANSITION}
                    type="button"
                    onClick={() => void handleVoteDelete()}
                    disabled={isBusy || deleteBusy}
                    className="plaza-delete-ballot__aye type-ui pressable disabled:opacity-50"
                  >
                    <Flame className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
                    {t('readerDeleteVoteAye')}
                  </motion.button>
                )}
                <div
                  className="plaza-delete-ballot__track"
                  aria-hidden="true"
                >
                  <div
                    className="plaza-delete-ballot__fill"
                    style={{
                      width: `${Math.round(
                        (deleteBallot.votes.length / Math.max(1, deleteBallot.electorate.length)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={deleteConfirmOpen}
        title={t('readerDeleteProposeTitle')}
        body={t('readerDeleteProposeBody')}
        confirmLabel={t('readerDeleteProposeAction')}
        danger
        icon={Flame}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void handleProposeDelete()}
      />

      <div
        className={`min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pt-3 pb-2 md:space-y-2 md:pt-4 md:pb-4 ${
          replyParent ? 'max-md:pb-32' : 'max-md:pb-24'
        }`}
      >
        {renderNode(tree, 0, true)}
      </div>

      <form
        onSubmit={(e) => void handleSubmitReply(e)}
        className="chrome-elev chrome-elev-md-flat fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface-raised/95 p-2 backdrop-blur-sm md:static md:bottom-auto md:z-auto md:mt-3 md:rounded-[var(--radius-panel)] md:border md:p-3"
      >
        <div className="mx-auto max-w-[1280px]">
          <AnimatePresence initial={false}>
            {replyParent && (
              <motion.div
                initial={disclosure.initial}
                animate={disclosure.animate}
                exit={disclosure.exit}
                transition={disclosure.transition}
                className="overflow-hidden"
              >
                <div className="thread-quote thread-quote--composer mb-2 items-center justify-between">
                  <span className="type-caption min-w-0 flex-1 truncate">
                    {replyAliasAt < 0 ? (
                      <span className="font-semibold text-ink">{replyLabel}</span>
                    ) : (
                      <>
                        {replyLabel.slice(0, replyAliasAt)}
                        <span className="font-semibold text-ink">{replyAlias}</span>
                        {replyLabel.slice(replyAliasAt + replyAlias.length)}
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyParent(null)}
                    aria-label={t('readerClearQuote')}
                    className="icon-action icon-action--dense pressable shrink-0 text-ink/70"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="thread-reply">
              {t('readerReply')}
            </label>
            <textarea
              id="thread-reply"
              value={replyBody}
              maxLength={MAX_BODY_CHARS}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={2}
              placeholder={t('readerComposePlaceholder')}
              className="input-base min-h-[4.5rem] flex-1 resize-none"
              required
            />
            <motion.button
              whileTap={replyBody.trim() && !submitting ? TAP : undefined}
              transition={TAP_TRANSITION}
              type="submit"
              disabled={!replyBody.trim() || isBusy || submitting}
              className="btn-accent-sheen inline-flex min-h-[44px] shrink-0 items-center gap-1.5 self-end rounded-[var(--radius-ctrl)] bg-accent px-3 py-2 type-ui font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <PlaneSendIcon
                planeKey={planeKey}
                launching={planeLaunching}
                busy={isBusy || submitting}
              />
              <span className="hidden sm:inline">
                {isBusy && !planeLaunching ? t('readerSending') : t('readerSend')}
              </span>
            </motion.button>
          </div>
        </div>
      </form>
    </div>
  );
}
