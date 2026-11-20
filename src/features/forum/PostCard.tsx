import { memo } from 'react';
import { CornerDownRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { PeerVisual } from '../../core/crypto/identity';
import type { ForumMessage } from '../../core/protocol';
import { formatClockTime } from '../../core/utils/inviteLink';
import { PeerAvatar } from '../../components/content/PeerAvatar';
import { SafeMessageBody } from '../../components/content/SafeMessageBody';
import { TAP, TAP_TRANSITION, postOrigin, resolveBubbleEnter } from '../../motion/tokens';

export const PostCard = memo(function PostCard({
  message,
  alias,
  visual,
  avatarSeed,
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
  avatarSeed?: string;
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
        <PeerAvatar
          avatarSeed={avatarSeed}
          matrix={visual?.identiconMatrix}
          size={24}
          label={alias}
          fg={visual?.fg}
          bg={visual?.bg}
          animated={false}
        />
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
});
