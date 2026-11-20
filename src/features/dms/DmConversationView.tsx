import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { MAX_DM_BODY_CHARS, type DirectMessage } from '../../core/protocol';
import type { TrustStore } from '../../core/trust/trustStore';
import { useLocale, useT } from '../../i18n';
import { formatClockTime } from '../../core/utils/inviteLink';
import { usePlaneLaunch } from '../../hooks/usePlaneLaunch';
import { PlaneSendIcon } from '../../components/ui/PlaneSendIcon';
import { PeerAvatar } from '../../components/content/PeerAvatar';
import { resolvePeerAvatarSeed } from '../../core/avatar/peerSeedCache';
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

export interface DmConversationViewProps {
  selfUserId: string;
  peerId: string;
  peerAlias: string;
  peerAvatarSeed?: string | null;
  messages: DirectMessage[];
  trustStore?: TrustStore | null;
  onSend: (body: string) => Promise<boolean>;
  onBack: () => void;
}

interface ThreadMeta {
  peerId: string;
  messages: DirectMessage[];
  knownIds: Set<string>;
  freshIds: Set<string>;
  fromSendIds: Set<string>;
  firstContentIds: Set<string>;
  wasEmpty: boolean;
}

function createInitialMeta(peerId: string, messages: DirectMessage[]): ThreadMeta {
  return {
    peerId,
    messages,
    knownIds: new Set(messages.map((m) => m.msgId)),
    freshIds: new Set(),
    fromSendIds: new Set(),
    firstContentIds: new Set(),
    wasEmpty: messages.length === 0,
  };
}

export function DmConversationView({
  selfUserId,
  peerId,
  peerAlias,
  peerAvatarSeed = null,
  messages,
  trustStore = null,
  onSend,
  onBack,
}: DmConversationViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const inputId = useId();

  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingSends, setPendingSends] = useState(0);
  const [trustTick, setTrustTick] = useState(0);
  const [meta, setMeta] = useState<ThreadMeta>(() => createInitialMeta(peerId, messages));

  const { planeKey, launching: planeLaunching, trigger: triggerPlane } = usePlaneLaunch();
  const logRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);
  const forceScrollRef = useRef(false);
  const mountedRef = useRef(false);
  const peerIdRef = useRef(peerId);

  if (meta.peerId !== peerId) {
    setMeta(createInitialMeta(peerId, messages));
    setBody('');
    setSending(false);
    setPendingSends(0);
  } else if (meta.messages !== messages) {
    const knownIds = new Set(meta.knownIds);
    const freshIds = new Set<string>();
    const fromSendIds = new Set(meta.fromSendIds);
    const firstContentIds = new Set(meta.firstContentIds);
    let wasEmpty = meta.wasEmpty;
    let remainingSends = pendingSends;

    for (const m of messages) {
      if (knownIds.has(m.msgId)) continue;
      knownIds.add(m.msgId);
      freshIds.add(m.msgId);
      if (wasEmpty && firstContentIds.size === 0) {
        firstContentIds.add(m.msgId);
        wasEmpty = false;
      }
      if (
        m.fromUserId === selfUserId &&
        remainingSends > 0 &&
        !fromSendIds.has(m.msgId)
      ) {
        fromSendIds.add(m.msgId);
        remainingSends -= 1;
      }
    }

    setMeta({
      peerId,
      messages,
      knownIds,
      freshIds,
      fromSendIds,
      firstContentIds,
      wasEmpty,
    });
    if (remainingSends !== pendingSends) {
      setPendingSends(remainingSends);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    peerIdRef.current = peerId;
    stickToBottomRef.current = true;
    forceScrollRef.current = false;
  }, [peerId]);

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
  }, [messages.length, peerId, reduceMotion]);

  const sendBody = async () => {
    const trimmed = body.trim();
    if (!trimmed || sending) return;
    const sendPeerId = peerId;
    setSending(true);
    triggerPlane();
    setPendingSends((n) => n + 1);
    forceScrollRef.current = true;
    stickToBottomRef.current = true;
    try {
      const ok = await onSend(trimmed);
      if (!mountedRef.current || peerIdRef.current !== sendPeerId) return;
      if (ok) {
        haptic(HAPTIC_TAP);
        setBody('');
        window.requestAnimationFrame(() => {
          inputRef.current?.focus();
          resizeComposer();
        });
      } else {
        setPendingSends((n) => Math.max(0, n - 1));
      }
    } finally {
      if (mountedRef.current && peerIdRef.current === sendPeerId) {
        setSending(false);
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendBody();
  };

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendBody();
    }
  };

  const hasText = Boolean(body.trim());
  const canSend = hasText && !sending;
  const sendLabel = sending ? t('dmsSending') : t('dmsSend');

  return (
    <main className="mx-auto flex h-full min-h-0 w-full max-w-[720px] flex-1 flex-col px-4 pt-3 pb-4 sm:px-8 sm:pt-5 sm:pb-6 md:pb-6">
      <header className="shrink-0 border-b border-border/80 pb-2.5">
        <div className="flex items-center gap-2.5">
          <motion.button
            whileTap={reduceMotion ? undefined : TAP}
            transition={TAP_TRANSITION}
            type="button"
            onClick={onBack}
            className="icon-action icon-action--ghost -ml-1.5 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={t('dmsBack')}
            title={t('dmsBack')}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </motion.button>
          <div className="min-w-0 flex-1">
            <h1 className="type-title flex min-w-0 items-center gap-2 text-ink">
              <PeerAvatar
                avatarSeed={resolvePeerAvatarSeed(peerAvatarSeed, peerId)}
                size={32}
                label={peerAlias}
                animated={false}
              />
              <span className="truncate">{peerAlias}</span>
              {peerVerified && (
                <span
                  role="img"
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
            const isFresh = meta.freshIds.has(msg.msgId);
            const firstContent = meta.firstContentIds.has(msg.msgId);
            const fromSend = meta.fromSendIds.has(msg.msgId) && !firstContent;
            const enter = resolveBubbleEnter(reduceMotion, {
              fromSend,
              firstContent,
            });

            return (
              <motion.div
                key={msg.msgId}
                layout={false}
                initial={isFresh ? enter.initial : false}
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
                    {isSelf && (
                      <motion.span
                        className="inline-flex shrink-0"
                        aria-hidden="true"
                        initial={isFresh && !reduceMotion ? sealIcon.initial : false}
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
        onSubmit={handleSubmit}
        className="chrome-elev chrome-elev-md-flat fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-30 border-t border-border/60 bg-bg/90 px-3 py-2.5 backdrop-blur-md md:static md:bottom-auto md:z-auto md:mt-4 md:rounded-[var(--radius-panel)] md:border md:border-border md:bg-surface-raised/95 md:p-3"
      >
        <div className="dm-composer mx-auto w-full max-w-[720px]">
          <label className="sr-only" htmlFor={inputId}>
            {t('dmsSend')}
          </label>
          <textarea
            ref={inputRef}
            id={inputId}
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
            whileTap={canSend && !reduceMotion ? TAP : undefined}
            transition={TAP_TRANSITION}
            type="submit"
            disabled={!canSend}
            aria-label={sendLabel}
            title={sendLabel}
            className={`dm-composer__send inline-flex h-10 w-10 cursor-pointer select-none items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed ${
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