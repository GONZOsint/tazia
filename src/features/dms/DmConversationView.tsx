import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { MAX_DM_BODY_CHARS, type DirectMessage } from '../../core/protocol';
import type { TrustStore } from '../../core/trust/trustStore';
import { useLocale, useT } from '../../i18n';
import { formatClockTime } from '../../core/utils/inviteLink';
import { usePlaneLaunch } from '../../hooks/usePlaneLaunch';
import { PlaneSendIcon } from '../../components/ui/PlaneSendIcon';
import { haptic, HAPTIC_TAP } from '../../motion/haptic';
import {
  TAP,
  TAP_TRANSITION,
  bubbleOrigin,
  resolveBubbleEnter,
  sealFlash,
  sealIcon,
} from '../../motion/tokens';

const NEAR_BOTTOM_PX = 96;

interface DmConversationViewProps {
  selfUserId: string;
  peerId: string;
  peerAlias: string;
  messages: DirectMessage[];
  trustStore?: TrustStore | null;
  onSend: (body: string) => Promise<boolean>;
  onBack: () => void;
}

export function DmConversationView({
  selfUserId,
  peerId,
  peerAlias,
  messages,
  trustStore = null,
  onSend,
  onBack,
}: DmConversationViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [trustTick, setTrustTick] = useState(0);
  const { planeKey, launching: planeLaunching, trigger: triggerPlane } = usePlaneLaunch();
  const logRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);
  const forceScrollRef = useRef(false);
  const enterReadyRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const seededRef = useRef(false);
  const fromSendIdsRef = useRef<Set<string>>(new Set());
  const pendingSendLandsRef = useRef(0);
  const firstContentIdsRef = useRef<Set<string>>(new Set());
  const wasEmptyRef = useRef(messages.length === 0);

  useEffect(() => {
    enterReadyRef.current = true;
  }, []);

  useEffect(() => {
    if (!trustStore) return;
    return trustStore.onChange(() => setTrustTick((n) => n + 1));
  }, [trustStore]);
  // trustTick forces re-read of getLevel after verify.
  const peerVerified = trustTick >= 0 && trustStore?.getLevel(peerId) === 'verified';

  const resizeComposer = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useLayoutEffect(() => {
    resizeComposer();
  }, [body, resizeComposer]);

  const freshIds = useMemo(() => {
    const fresh = new Set<string>();
    if (!seededRef.current) return fresh;
    for (const m of messages) {
      if (knownIdsRef.current.has(m.msgId)) continue;
      fresh.add(m.msgId);
      if (wasEmptyRef.current && firstContentIdsRef.current.size === 0) {
        firstContentIdsRef.current.add(m.msgId);
        wasEmptyRef.current = false;
      }
      if (
        m.fromUserId === selfUserId &&
        pendingSendLandsRef.current > 0 &&
        !fromSendIdsRef.current.has(m.msgId)
      ) {
        fromSendIdsRef.current.add(m.msgId);
        pendingSendLandsRef.current -= 1;
      }
    }
    return fresh;
  }, [messages, selfUserId]);

  useLayoutEffect(() => {
    if (!seededRef.current) {
      knownIdsRef.current = new Set(messages.map((m) => m.msgId));
      seededRef.current = true;
      wasEmptyRef.current = messages.length === 0;
      return;
    }
    for (const m of messages) knownIdsRef.current.add(m.msgId);
  }, [messages]);

  const updateStick = () => {
    const el = logRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  useEffect(() => {
    if (!forceScrollRef.current && !stickToBottomRef.current) return;
    forceScrollRef.current = false;
    bottomRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [messages.length, reduceMotion]);

  const sendBody = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    triggerPlane();
    pendingSendLandsRef.current += 1;
    forceScrollRef.current = true;
    stickToBottomRef.current = true;
    try {
      const ok = await onSend(body.trim());
      if (ok) {
        haptic(HAPTIC_TAP);
        setBody('');
        window.requestAnimationFrame(() => {
          inputRef.current?.focus();
          resizeComposer();
        });
      } else {
        pendingSendLandsRef.current = Math.max(0, pendingSendLandsRef.current - 1);
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendBody();
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendBody();
    }
  };

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-[720px] flex-1 flex-col px-4 py-4 sm:px-8 sm:py-6 md:pb-6">
      <header className="shrink-0 border-b border-border pb-3">
        <div className="flex items-center gap-3">
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
          <div className="min-w-0 flex-1">
            <h1 className="type-title flex min-w-0 items-center gap-1.5 text-ink">
              <span className="truncate">{peerAlias}</span>
              {peerVerified && (
                <span
                  className="inline-flex shrink-0 text-ok"
                  title={t('trustVerified')}
                  aria-label={t('trustVerified')}
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
                </span>
              )}
            </h1>
          </div>
        </div>
      </header>

      <div
        ref={logRef}
        role="log"
        aria-relevant="additions"
        aria-label={peerAlias}
        onScroll={updateStick}
        className="relative mt-3 min-h-0 flex-1 space-y-2 overflow-x-clip overflow-y-auto overscroll-contain max-md:pb-28 md:pb-4"
      >
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">{t('dmsThreadEmpty')}</p>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isSelf = msg.fromUserId === selfUserId;
            const animateEnter = enterReadyRef.current;
            const isFresh = animateEnter && freshIds.has(msg.msgId);
            const firstContent = firstContentIdsRef.current.has(msg.msgId);
            const fromSend = fromSendIdsRef.current.has(msg.msgId) && !firstContent;
            const enter = resolveBubbleEnter(reduceMotion, {
              fromSend,
              firstContent,
            });
            const showSeal = isSelf;
            return (
              <motion.div
                key={msg.msgId}
                layout={false}
                initial={animateEnter ? enter.initial : false}
                animate={enter.animate}
                exit={enter.exit}
                transition={enter.transition}
                style={bubbleOrigin(isSelf)}
                className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`dm-bubble max-w-[80%] ${isSelf ? 'dm-bubble--self' : ''}`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  <motion.p
                    className={`type-caption mt-1 inline-flex items-center gap-1 ${
                      isSelf ? 'text-on-accent/60' : ''
                    }`}
                    initial={isSelf && isFresh && !reduceMotion ? sealFlash.initial : false}
                    animate={
                      isSelf && isFresh && !reduceMotion
                        ? sealFlash.animate
                        : { opacity: 1 }
                    }
                  >
                    {showSeal && (
                      <motion.span
                        className="inline-flex shrink-0"
                        aria-hidden="true"
                        initial={isFresh ? sealIcon.initial : false}
                        animate={sealIcon.animate}
                      >
                        <Lock className="h-2.5 w-2.5 opacity-80" strokeWidth={2.25} />
                      </motion.span>
                    )}
                    {formatClockTime(msg.createdAtMs, locale)}
                  </motion.p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="chrome-elev chrome-elev-md-flat fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface-raised/95 p-2.5 backdrop-blur-sm md:static md:bottom-auto md:z-auto md:mt-4 md:rounded-[var(--radius-panel)] md:border md:p-3"
      >
        <div className="dm-composer mx-auto w-full max-w-[720px]">
          <label className="sr-only" htmlFor="dm-body">
            {t('dmsSend')}
          </label>
          <textarea
            ref={inputRef}
            id="dm-body"
            value={body}
            maxLength={MAX_DM_BODY_CHARS}
            rows={1}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder={t('dmsPlaceholder')}
            className="dm-composer__field"
            enterKeyHint="send"
          />
          <motion.button
            whileTap={body.trim() && !sending ? TAP : undefined}
            transition={TAP_TRANSITION}
            type="submit"
            disabled={!body.trim() || sending}
            aria-label={sending ? t('dmsSending') : t('dmsSend')}
            className="btn-accent-sheen dm-composer__send inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <PlaneSendIcon
              planeKey={planeKey}
              launching={planeLaunching}
              busy={sending}
            />
          </motion.button>
        </div>
      </form>
    </main>
  );
}

export default DmConversationView;
