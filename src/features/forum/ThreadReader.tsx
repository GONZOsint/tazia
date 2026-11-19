import { useEffect, useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
  visualFromUserId,
  type LocalProfile,
  type PeerVisual,
} from '../../core/crypto/identity';
import {
  peerAvatarSeed,
  rememberPeerAvatarSeeds,
} from '../../core/avatar/peerSeedCache';
import type { ThreadDeleteBallot } from '../../core/forum/threadDelete';
import { useLocale, useT } from '../../i18n';
import type { ForumMessage } from '../../core/protocol';
import { usePlaneLaunch } from '../../hooks/usePlaneLaunch';
import { haptic, HAPTIC_TAP } from '../../motion/haptic';
import { TAP, TAP_TRANSITION } from '../../motion/tokens';
import { PostCard } from './PostCard';
import { resolveForumAlias } from './resolveForumAlias';
import { ThreadDeleteBallotBar } from './ThreadDeleteBallot';
import { ThreadReplyComposer } from './ThreadReplyComposer';
import { buildTree, INDENT_PX, MAX_DEPTH, snippetOf, type TreeNode } from './threadTree';
import type { ThreadGroup } from './types';
import { usePostEnterAnimation } from './usePostEnterAnimation';

export type AuthorVisualCache = Record<string, PeerVisual>;

interface ThreadReaderProps {
  thread: ThreadGroup;
  identity: LocalProfile;
  selfUserId: string;
  presenceAliases: Record<string, string>;
  presenceAvatarSeeds: Record<string, string>;
  authorVisuals: AuthorVisualCache;
  onAuthorVisuals: (next: AuthorVisualCache) => void;
  onlineUserIds: string[];
  deleteBallot: ThreadDeleteBallot | null;
  isBusy: boolean;
  onReplyThread: (threadId: string, parentMsgId: string, body: string) => Promise<boolean>;
  onProposeDeleteThread: (threadId: string, electorate: string[]) => Promise<boolean>;
  onVoteDeleteThread: (threadId: string, proposalMsgId: string) => Promise<boolean>;
}

export function ThreadReader({
  thread,
  identity,
  selfUserId,
  presenceAliases,
  presenceAvatarSeeds,
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

  const posts = useMemo(
    () => [thread.rootPost, ...thread.replies],
    [thread.rootPost, thread.replies]
  );

  const {
    enterReady,
    freshIds,
    fromSendIds,
    firstContentIds,
    notePendingSend,
    cancelPendingSend,
  } = usePostEnterAnimation(thread.threadId, posts, thread.replies.length, selfUserId);

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

  const aliasOpts = {
    presenceAliases,
    selfUserId,
    identity,
    authorVisuals,
    fallback: t('presenceNoAlias'),
  };

  const resolveAlias = (userId: string) => resolveForumAlias(userId, aliasOpts);

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
    return pending.map((id) => resolveForumAlias(id, aliasOpts)).join(', ');
  }, [deleteBallot, presenceAliases, selfUserId, identity.alias, authorVisuals, t]);

  const handleProposeDelete = async () => {
    if (isBusy || deleteBusy || deleteBallot) return;
    setDeleteBusy(true);
    try {
      const electorate = [...new Set([selfUserId, ...onlineUserIds.filter(Boolean)])];
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
    notePendingSend();
    const parentId = replyParent ? replyParent.msgId : thread.rootPost.msgId;
    try {
      const ok = await onReplyThread(thread.threadId, parentId, replyBody.trim());
      if (ok) {
        haptic(HAPTIC_TAP);
        setReplyBody('');
        setReplyParent(null);
      } else {
        cancelPendingSend();
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
          avatarSeed={
            msg.authorUserId === selfUserId
              ? identity.avatarSeed
              : presenceAvatarSeeds[msg.authorUserId] ||
                peerAvatarSeed(msg.authorUserId)
          }
          isSelf={msg.authorUserId === selfUserId}
          depth={depth}
          parentAlias={parentAlias}
          parentSnippet={parentSnippet}
          highlighted={highlightId === msg.msgId}
          onReply={() => handleReplyClick(msg)}
          youSuffix={t('readerYou')}
          replyLabel={t('readerReply')}
          locale={locale}
          animateEnter={enterReady}
          fromSend={
            enterReady &&
            freshIds.has(msg.msgId) &&
            fromSendIds.has(msg.msgId) &&
            !firstContentIds.has(msg.msgId)
          }
          firstContent={enterReady && firstContentIds.has(msg.msgId)}
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="plaza-title flex shrink-0 items-start justify-between gap-2">
        <h2 className="type-title min-w-0 flex-1 text-ink">{thread.title}</h2>
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

      <ThreadDeleteBallotBar
        deleteBallot={deleteBallot}
        waitingNames={waitingNames}
        selfIsElector={selfIsElector}
        selfHasVoted={selfHasVoted}
        isBusy={isBusy}
        deleteBusy={deleteBusy}
        deleteConfirmOpen={deleteConfirmOpen}
        onCancelConfirm={() => setDeleteConfirmOpen(false)}
        onProposeDelete={() => void handleProposeDelete()}
        onVoteDelete={() => void handleVoteDelete()}
      />

      <div
        className={`min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pt-3 pb-2 md:space-y-2 md:pt-4 md:pb-4 ${
          replyParent ? 'max-md:pb-32' : 'max-md:pb-24'
        }`}
      >
        {renderNode(tree, 0, true)}
      </div>

      <ThreadReplyComposer
        replyBody={replyBody}
        onReplyBodyChange={setReplyBody}
        replyParent={replyParent}
        onClearParent={() => setReplyParent(null)}
        replyLabel={replyLabel}
        replyAlias={replyAlias}
        isBusy={isBusy}
        submitting={submitting}
        planeKey={planeKey}
        planeLaunching={planeLaunching}
        onSubmit={(e) => void handleSubmitReply(e)}
      />
    </div>
  );
}
