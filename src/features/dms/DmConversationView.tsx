import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Lock, LockOpen, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { DirectMessage } from '../../core/protocol';
import { useLocale, useT } from '../../i18n';
import { formatClockTime } from '../../core/utils/inviteLink';
import { usePlaneLaunch } from '../../hooks/usePlaneLaunch';
import { TAP, TAP_TRANSITION, bubbleEnter, sealIcon } from '../../motion/tokens';

interface DmConversationViewProps {
  selfUserId: string;
  peerId: string;
  peerAlias: string;
  messages: DirectMessage[];
  onSend: (body: string) => Promise<boolean>;
  onBack: () => void;
}

function SealedMark({ isSelf }: { isSelf: boolean }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setOpen(false), isSelf ? 420 : 520);
    return () => window.clearTimeout(id);
  }, [isSelf]);

  const Icon = isSelf ? Lock : open ? LockOpen : Lock;
  const tone = isSelf ? 'text-on-accent/70' : 'text-muted';

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.span
          key="seal"
          initial={sealIcon.initial}
          animate={sealIcon.animate}
          exit={sealIcon.exit}
          className={`mb-1 inline-flex ${tone}`}
          aria-hidden="true"
        >
          <Icon className="h-3 w-3" strokeWidth={2} />
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export function DmConversationView({
  selfUserId,
  peerId: _peerId,
  peerAlias,
  messages,
  onSend,
  onBack,
}: DmConversationViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const { planeKey, launching: planeLaunching, trigger: triggerPlane } = usePlaneLaunch();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    triggerPlane();
    try {
      const ok = await onSend(body.trim());
      if (ok) setBody('');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-[720px] flex-col px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <motion.button
          whileTap={TAP}
          transition={TAP_TRANSITION}
          type="button"
          onClick={onBack}
          className="icon-action icon-action--ghost focus-visible:outline-2 focus-visible:outline-accent"
          aria-label={t('dmsBack')}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </motion.button>
        <h1 className="truncate font-display text-lg font-semibold text-ink">{peerAlias}</h1>
      </div>

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">{t('dmsEmpty')}</p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isSelf = msg.fromUserId === selfUserId;
            const sealed = msg.seal === 2;
            return (
              <motion.div
                key={msg.msgId}
                initial={bubbleEnter.initial}
                animate={bubbleEnter.animate}
                transition={bubbleEnter.transition}
                className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`dm-bubble max-w-[80%] ${isSelf ? 'dm-bubble--self' : ''}`}
                >
                  {sealed && <SealedMark isSelf={isSelf} />}
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      isSelf ? 'text-on-accent/60' : 'text-muted'
                    }`}
                  >
                    {formatClockTime(msg.createdAtMs, locale)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mt-4 flex gap-2 border-t border-border pt-4"
      >
        <label className="sr-only" htmlFor="dm-body">
          {t('dmsSend')}
        </label>
        <input
          id="dm-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('dmsPlaceholder')}
          className="input-base flex-1"
        />
        <motion.button
          whileTap={body.trim() && !sending ? TAP : undefined}
          transition={TAP_TRANSITION}
          type="submit"
          disabled={!body.trim() || sending}
          aria-label={sending ? t('dmsSending') : t('dmsSend')}
          className="btn-accent-sheen inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-ctrl)] bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {sending && !planeLaunching ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <span key={planeKey} className={planeKey > 0 ? 'plane-launching' : 'inline-flex'}>
              <Send className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </motion.button>
      </form>
    </main>
  );
}

export default DmConversationView;
