import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ForumMessage } from '../../core/protocol';
import { MAX_BODY_CHARS } from '../../core/protocol';
import { useT } from '../../i18n';
import { PlaneSendIcon } from '../../components/ui/PlaneSendIcon';
import { TAP, TAP_TRANSITION, disclosure } from '../../motion/tokens';

type ThreadReplyComposerProps = {
  replyBody: string;
  onReplyBodyChange: (v: string) => void;
  replyParent: ForumMessage | null;
  onClearParent: () => void;
  replyLabel: string;
  replyAlias: string;
  isBusy: boolean;
  submitting: boolean;
  planeKey: number;
  planeLaunching: boolean;
  onSubmit: (e: React.FormEvent) => void;
};

export function ThreadReplyComposer({
  replyBody,
  onReplyBodyChange,
  replyParent,
  onClearParent,
  replyLabel,
  replyAlias,
  isBusy,
  submitting,
  planeKey,
  planeLaunching,
  onSubmit,
}: ThreadReplyComposerProps) {
  const t = useT();
  const replyAliasAt = replyAlias ? replyLabel.lastIndexOf(replyAlias) : -1;

  return (
    <form
      onSubmit={onSubmit}
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
                  onClick={onClearParent}
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
            onChange={(e) => onReplyBodyChange(e.target.value)}
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
  );
}
