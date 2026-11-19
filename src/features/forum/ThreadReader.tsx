import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownRight, Loader2, Send, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { visualFromUserId, type LocalProfile } from '../../core/crypto/identity';
import { useLocale, useT } from '../../i18n';
import { MAX_BODY_CHARS, type ForumMessage } from '../../core/protocol';
import { formatClockTime } from '../../core/utils/inviteLink';
import { Identicon } from '../../components/content/Identicon';
import { SafeMessageBody } from '../../components/content/SafeMessageBody';
import { usePlaneLaunch } from '../../hooks/usePlaneLaunch';
import { DUR, EASE, TAP, TAP_TRANSITION, bubbleEnter } from '../../motion/tokens';
import type { ThreadGroup } from './RoomSidebar';

export type AuthorVisualCache = Record<
  string,
  { fingerprintHex: string; identiconMatrix: boolean[] }
>;

interface ThreadReaderProps {
  thread: ThreadGroup;
  identity: LocalProfile;
  selfUserId: string;
  presenceAliases: Record<string, string>;
  authorVisuals: AuthorVisualCache;
  onAuthorVisuals: (next: AuthorVisualCache) => void;
  isBusy: boolean;
  onReplyThread: (threadId: string, parentMsgId: string, body: string) => Promise<boolean>;
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
}: {
  message: ForumMessage;
  alias: string;
  visual?: { identiconMatrix: boolean[] };
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
}) {
  const nested = depth > 0;
  return (
    <motion.article
      layout={false}
      initial={animateEnter ? bubbleEnter.initial : false}
      animate={bubbleEnter.animate}
      transition={bubbleEnter.transition}
      className={`plaza-post ${nested ? 'plaza-post--nested' : ''} ${
        isSelf ? 'plaza-post--self' : ''
      } ${highlighted ? 'is-highlighted' : ''}`}
    >
      <header className="flex items-center gap-2">
        {visual ? (
          <Identicon matrix={visual.identiconMatrix} size={22} label={alias} />
        ) : (
          <div className="h-[22px] w-[22px] rounded-[var(--radius-ctrl)] bg-surface" />
        )}
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
          {alias}
          {isSelf ? youSuffix : ''}
          <span className="ml-1.5 font-normal text-[11px] text-muted">
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
          className="icon-action icon-action--ghost text-muted hover:text-ink"
        >
          <CornerDownRight className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
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

      <div className="mt-1.5 text-sm leading-snug">
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
  isBusy,
  onReplyThread,
}: ThreadReaderProps) {
  const t = useT();
  const { locale } = useLocale();
  const [replyBody, setReplyBody] = useState('');
  const [replyParent, setReplyParent] = useState<ForumMessage | null>(null);
  const { planeKey, launching: planeLaunching, trigger: triggerPlane } = usePlaneLaunch();
  const [submitting, setSubmitting] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  /** After first paint, new posts may land with bubbleEnter. */
  const enterReadyRef = useRef(false);
  useEffect(() => {
    enterReadyRef.current = true;
  }, []);

  const posts = useMemo(
    () => [thread.rootPost, ...thread.replies],
    [thread.rootPost, thread.replies]
  );

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
    (userId === selfUserId ? identity.alias : t('presenceNoAlias'));

  const handleReplyClick = (msg: ForumMessage) => {
    setReplyParent(msg);
    setHighlightId(msg.msgId);
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() || isBusy || submitting) return;
    setSubmitting(true);
    triggerPlane();
    const parentId = replyParent ? replyParent.msgId : thread.rootPost.msgId;
    try {
      const ok = await onReplyThread(thread.threadId, parentId, replyBody.trim());
      if (ok) {
        setReplyBody('');
        setReplyParent(null);
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
        />
        {node.children.map((child, i) =>
          renderNode(child, depth + 1, i === node.children.length - 1)
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="plaza-title shrink-0">
        <h2 className="font-display text-lg font-semibold text-ink sm:text-xl [text-wrap:balance]">
          {thread.title}
        </h2>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto py-2 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:space-y-2 md:pb-4">
        {renderNode(tree, 0, true)}
      </div>

      <form
        onSubmit={(e) => void handleSubmitReply(e)}
        className="chrome-elev chrome-elev-md-flat fixed inset-x-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface-raised/95 p-2 backdrop-blur-sm md:static md:bottom-auto md:z-auto md:mt-3 md:rounded-[var(--radius-panel)] md:border md:p-3"
      >
        <div className="mx-auto max-w-[1280px]">
          <AnimatePresence initial={false}>
            {replyParent && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: DUR.tab, ease: EASE.outExpo }}
                className="overflow-hidden"
              >
                <div className="thread-quote mb-2 items-center justify-between">
                  <span className="min-w-0 flex-1 truncate">
                    {t('readerReplyingTo', { alias: resolveAlias(replyParent.authorUserId) })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyParent(null)}
                    aria-label={t('readerClearQuote')}
                    className="icon-action icon-action--ghost icon-action--dense pressable shrink-0"
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
              className="input-base flex-1"
              required
            />
            <motion.button
              whileTap={replyBody.trim() && !submitting ? TAP : undefined}
              transition={TAP_TRANSITION}
              type="submit"
              disabled={!replyBody.trim() || isBusy || submitting}
              className="btn-accent-sheen inline-flex min-h-[44px] shrink-0 items-center gap-1.5 self-end rounded-[var(--radius-ctrl)] bg-accent px-3 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {isBusy && !planeLaunching ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <span key={planeKey} className={planeKey > 0 ? 'plane-launching' : 'inline-flex'}>
                  <Send className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
                </span>
              )}
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
