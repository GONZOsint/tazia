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
    // Collapse to min before measure so shrink works; min (not 0) avoids a blank flash.
    el.style.height = '40px';
    const next = Math.min(Math.max(el.scrollHeight, 40), 120);
    el.style.height = `${next}px`;
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
    const force = forceScrollRef.current;
    forceScrollRef.current = false;
    // Defer one frame so bubble enter / composer resize settle before scrolling.
    const behavior: ScrollBehavior = reduceMotion || !force ? 'auto' : 'smooth';
    const id = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
    return () => window.cancelAnimationFrame(id);
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

  const hasText = Boolean(body.trim());
  const canSend = hasText && !sending;

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-[720px] flex-1 flex-col px-4 pt-3 pb-4 sm:px-8 sm:pt-5 sm:pb-6 md:pb-6">
      <header className="shrink-0 border-b border-border/80 pb-2.5">
        <div className="flex items-center gap-2.5">
          <motion.button
            whileTap={TAP}
            transition={TAP_TRANSITION}
            type="button"
            onClick={onBack}
            className="icon-action icon-action--ghost -ml-1.5 focus-visible:outline-2 focus-visible:outline-accent"
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
            <p className="type-caption mt-0.5 truncate" title={t('dmsSealedHintDetail')}>
              {t('dmsSealedHint')}
            </p>
          </div>
        </div>
      </header>

      <div
        ref={logRef}
        role="log"
        aria-relevant="additions"
        aria-label={peerAlias}
        onScroll={updateStick}
        className="relative mt-3 min-h-0 flex-1 space-y-1.5 overflow-x-clip overflow-y-auto overscroll-contain max-md:pb-28 md:pb-4"
      >
        {messages.length === 0 && (
          <p className="mx-auto max-w-[22rem] py-10 text-center text-sm leading-snug text-muted">
            {t('dmsThreadEmpty')}
          </p>
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
                <div className={`dm-bubble ${isSelf ? 'dm-bubble--self' : ''}`}>
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                  <motion.p
                    className="dm-bubble__meta type-caption"
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
                        <Lock className="h-2.5 w-2.5" strokeWidth={2.4} />
                      </motion.span>
                    )}
                    <time dateTime={new Date(msg.createdAtMs).toISOString()}>
                      {formatClockTime(msg.createdAtMs, locale)}
                    </time>
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
        className="chrome-elev chrome-elev-md-flat fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-30 border-t border-border/60 bg-bg/90 px-3 py-2.5 backdrop-blur-md md:static md:bottom-auto md:z-auto md:mt-4 md:rounded-[var(--radius-panel)] md:border md:border-border md:bg-surface-raised/95 md:p-3"
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
            style={{ height: '40px' }}
            enterKeyHint="send"
          />
          <motion.button
            whileTap={canSend ? TAP : undefined}
            transition={TAP_TRANSITION}
            type="submit"
            disabled={!canSend}
            aria-label={sending ? t('dmsSending') : t('dmsSend')}
            className={`dm-composer__send inline-flex h-10 w-10 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-accent ${
              hasText ? 'dm-composer__send--ready btn-accent-sheen' : ''
            }`}
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
