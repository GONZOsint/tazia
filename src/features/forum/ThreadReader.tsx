import { useEffect, useMemo, useState } from 'react';
import { CornerDownRight, Loader2, Send, X } from 'lucide-react';
import { motion } from 'motion/react';
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
  onReplyThread: (threadId: string, parentMsgId: string, body: string) => Promise<void>;
}

function PostCard({
  message,
  alias,
  visual,
  isSelf,
  onReply,
  youSuffix,
  replyLabel,
  locale,
}: {
  message: ForumMessage;
  alias: string;
  visual?: { identiconMatrix: boolean[] };
  isSelf: boolean;
  onReply: () => void;
  youSuffix: string;
  replyLabel: string;
  locale: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface-raised p-4 sm:p-5">
      <header className="flex flex-wrap items-center gap-2.5">
        {visual ? (
          <Identicon matrix={visual.identiconMatrix} size={28} label={alias} />
        ) : (
          <div className="h-7 w-7 rounded-lg bg-surface" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">
            {alias}
            {isSelf ? youSuffix : ''}
          </p>
          <p className="text-[11px] text-muted">
            {formatClockTime(message.createdAtMs, locale)}
          </p>
        </div>
        <button
          type="button"
          onClick={onReply}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted"
        >
          <CornerDownRight className="h-3 w-3" aria-hidden="true" />
          {replyLabel}
        </button>
      </header>
      <div className="mt-3">
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

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() || isBusy) return;
    const parentId = replyParent ? replyParent.msgId : thread.rootPost.msgId;
    await onReplyThread(thread.threadId, parentId, replyBody.trim());
    setReplyBody('');
    setReplyParent(null);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold text-ink [text-wrap:balance]">
          {thread.title}
        </h2>
      </div>

      <div className="space-y-3">
        {posts.map((message) => (
          <PostCard
            key={message.msgId}
            message={message}
            alias={
              presenceAliases[message.authorUserId] ||
              (message.authorUserId === selfUserId ? identity.alias : t('presenceNoAlias'))
            }
            visual={authorVisuals[message.authorUserId]}
            isSelf={message.authorUserId === selfUserId}
            onReply={() => setReplyParent(message)}
            youSuffix={t('readerYou')}
            replyLabel={t('readerReply')}
            locale={locale}
          />
        ))}
      </div>

      <motion.form
        layout
        onSubmit={(e) => void handleSubmitReply(e)}
        className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-10 rounded-2xl border border-border bg-surface-raised p-5 shadow-sm md:static md:shadow-none"
      >
        {replyParent && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2 text-xs text-muted">
            <span className="truncate">{t('readerReplyingTo')}…</span>
            <button
              type="button"
              onClick={() => setReplyParent(null)}
              aria-label={t('readerClearQuote')}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <textarea
          value={replyBody}
          maxLength={MAX_BODY_CHARS}
          onChange={(e) => setReplyBody(e.target.value)}
          rows={3}
          placeholder={t('composerAs', { alias: identity.alias })}
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm"
          required
        />
        <button
          type="submit"
          disabled={!replyBody.trim() || isBusy}
          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          {isBusy ? t('readerSending') : t('readerSend')}
        </button>
      </motion.form>
    </div>
  );
}
