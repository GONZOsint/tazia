import { useEffect, useMemo, useState } from 'react';
import { CornerDownRight, Loader2, Send, X } from 'lucide-react';
import { visualFromUserId, type LocalProfile } from '../../core/crypto/identity';
import { useLocale, useT } from '../../i18n';
import { MAX_BODY_CHARS, type ForumMessage } from '../../core/protocol';
import { formatClockTime } from '../../core/utils/inviteLink';
import { Identicon } from '../../components/content/Identicon';
import { SafeMessageBody } from '../../components/content/SafeMessageBody';
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
      // Flatten deeper replies under this node
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

function snippetOf(text: string, max = 72): string {
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
  parentSnippet,
  onReply,
  youSuffix,
  replyLabel,
  replySnippetLabel,
  locale,
}: {
  message: ForumMessage;
  alias: string;
  visual?: { identiconMatrix: boolean[] };
  isSelf: boolean;
  depth: number;
  parentSnippet: string | null;
  onReply: () => void;
  youSuffix: string;
  replyLabel: string;
  replySnippetLabel: string;
  locale: string;
}) {
  const pad = Math.min(depth, MAX_DEPTH) * 12;
  return (
    <article
      className={`rounded-xl border border-border bg-surface-raised p-3 sm:p-4 ${
        depth > 0 ? 'border-l-2 border-l-accent/40' : ''
      }`}
      style={depth > 0 ? { marginLeft: pad } : undefined}
    >
      <header className="flex flex-wrap items-center gap-2">
        {visual ? (
          <Identicon matrix={visual.identiconMatrix} size={26} label={alias} />
        ) : (
          <div className="h-6 w-6 rounded-lg bg-surface" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {alias}
            {isSelf ? youSuffix : ''}
          </p>
          <p className="text-[11px] text-muted">{formatClockTime(message.createdAtMs, locale)}</p>
        </div>
        <button
          type="button"
          onClick={onReply}
          className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted focus-visible:outline-2 focus-visible:outline-accent"
        >
          <CornerDownRight className="h-3 w-3" aria-hidden="true" />
          {replyLabel}
        </button>
      </header>
      {parentSnippet && (
        <p className="mt-1.5 truncate text-[11px] text-faint">{replySnippetLabel}</p>
      )}
      <div className="mt-2 text-sm">
        <SafeMessageBody text={message.body} />
      </div>
    </article>
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

  const resolveAlias = (userId: string) =>
    presenceAliases[userId] ||
    (userId === selfUserId ? identity.alias : t('presenceNoAlias'));

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() || isBusy) return;
    const parentId = replyParent ? replyParent.msgId : thread.rootPost.msgId;
    const ok = await onReplyThread(thread.threadId, parentId, replyBody.trim());
    if (ok) {
      setReplyBody('');
      setReplyParent(null);
    }
  };

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const msg = node.message;
    const parent =
      msg.parentMsgId && msg.msgId !== thread.rootPost.msgId
        ? byId.get(msg.parentMsgId) ?? null
        : null;
    const parentSnippet =
      parent && depth > 0 ? snippetOf(parent.body) : null;
    return (
      <div key={msg.msgId} className="space-y-2">
        <PostCard
          message={msg}
          alias={resolveAlias(msg.authorUserId)}
          visual={authorVisuals[msg.authorUserId]}
          isSelf={msg.authorUserId === selfUserId}
          depth={depth}
          parentSnippet={parentSnippet}
          onReply={() => setReplyParent(msg)}
          youSuffix={t('readerYou')}
          replyLabel={t('readerReply')}
          replySnippetLabel={
            parentSnippet
              ? t('readerReplyToSnippet', { snippet: parentSnippet })
              : ''
          }
          locale={locale}
        />
        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border pb-3 sm:rounded-2xl sm:border sm:border-border sm:bg-surface-raised sm:p-5 sm:pb-5">
        <h2 className="font-display text-lg font-semibold text-ink sm:text-xl [text-wrap:balance]">
          {thread.title}
        </h2>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-3 pb-[calc(9.5rem+env(safe-area-inset-bottom))] md:space-y-3 md:pb-4">
        {renderNode(tree, 0)}
      </div>

      <form
        onSubmit={(e) => void handleSubmitReply(e)}
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface-raised/95 p-3 backdrop-blur-sm md:static md:bottom-auto md:z-auto md:mt-3 md:rounded-2xl md:border md:p-4 md:shadow-none"
      >
        <div className="mx-auto max-w-[1280px]">
          {replyParent && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-1.5 text-xs text-muted">
              <span className="truncate">
                {t('readerReplyingTo', { alias: resolveAlias(replyParent.authorUserId) })}
              </span>
              <button
                type="button"
                onClick={() => setReplyParent(null)}
                aria-label={t('readerClearQuote')}
                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
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
              placeholder={t('composerAs', { alias: identity.alias })}
              className="min-h-[44px] flex-1 rounded-xl border border-border bg-surface-raised px-3 py-2 text-[16px] text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-accent/30"
              required
            />
            <button
              type="submit"
              disabled={!replyBody.trim() || isBusy}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 self-end rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {isBusy ? t('readerSending') : t('readerSend')}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
