import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Lock, LockOpen, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { DirectMessage } from '../../core/protocol';
import { useLocale, useT } from '../../i18n';
import { formatClockTime } from '../../core/utils/inviteLink';
import { usePlaneLaunch } from '../../hooks/usePlaneLaunch';
import { SEAL_FLASH_MS, TAP, TAP_TRANSITION, bubbleEnter, sealIcon } from '../../motion/tokens';

interface DmConversationViewProps {
  selfUserId: string;
  peerId: string;
  peerAlias: string;
  messages: DirectMessage[];
  onSend: (body: string) => Promise<boolean>;
  onBack: () => void;
}

function SealedFlash({ isSelf }: { isSelf: boolean }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setOpen(false), SEAL_FLASH_MS);
    return () => window.clearTimeout(id);
  }, []);

  const Icon = isSelf ? Lock : open ? LockOpen : Lock;
  const tone = isSelf ? 'text-on-accent/75' : 'text-muted';

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.span
          key="seal"
          initial={sealIcon.initial}
          animate={sealIcon.animate}
          exit={sealIcon.exit}
          className={`mt-0.5 inline-flex shrink-0 ${tone}`}
          aria-hidden="true"
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
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
    <main className="mx-auto flex max-w-[720px] flex-col px-4 py-4 sm:px-8 sm:py-6 md:pb-6">
      <div className="flex shrink-0 items-center gap-3 border-b border-border pb-4">
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

      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-4">
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
                  <div className="flex items-start gap-1.5">
                    {sealed && <SealedFlash isSelf={isSelf} />}
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                      <p
                        className={`mt-1 inline-flex items-center gap-1 text-[10px] ${
                          isSelf ? 'text-on-accent/60' : 'text-muted'
                        }`}
                      >
                        {sealed && (
                          <Lock
                            className="h-2.5 w-2.5 shrink-0 opacity-80"
                            strokeWidth={2.25}
                            aria-hidden="true"
                          />
                        )}
                        {formatClockTime(msg.createdAtMs, locale)}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="chrome-elev chrome-elev-md-flat fixed inset-x-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-30 flex gap-2 border-t border-border bg-surface-raised/95 p-3 backdrop-blur-sm md:static md:bottom-auto md:z-auto md:mt-4 md:rounded-[var(--radius-panel)] md:border md:p-3"
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
          className="btn-accent-sheen inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-[var(--radius-ctrl)] bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
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
