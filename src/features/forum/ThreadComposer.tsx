import { useEffect, useRef, useState } from 'react';
import { FileText, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { LocalProfile } from '../../core/crypto/identity';
import { useT } from '../../i18n';
import { MAX_BODY_CHARS, MAX_TITLE_CHARS } from '../../core/protocol';
import { usePlaneLaunch } from '../../hooks/usePlaneLaunch';
import { PlaneSendIcon } from '../../components/ui/PlaneSendIcon';
import { PeerAvatar } from '../../components/content/PeerAvatar';
import {
  FIRE_BTN_PILL,
  mountFireButton,
  type FireButtonHandle,
} from '../../motion/fireButton';
import { TAP, TAP_TRANSITION } from '../../motion/tokens';

interface ThreadComposerProps {
  identity: LocalProfile;
  isBusy: boolean;
  onCancel: () => void;
  onSubmitThread: (title: string, body: string) => Promise<boolean>;
}

export function ThreadComposer({
  identity,
  isBusy,
  onCancel,
  onSubmitThread,
}: ThreadComposerProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const { planeKey, launching: planeLaunching, trigger: triggerPlane } = usePlaneLaunch();
  const bannerRef = useRef<HTMLDivElement>(null);
  const fireCanvasRef = useRef<HTMLCanvasElement>(null);
  const fireHandleRef = useRef<FireButtonHandle | null>(null);
  /** Guards double-submit before React flips isPublishing. */
  const submittingRef = useRef(false);

  const overLimit =
    title.length > MAX_TITLE_CHARS || body.length > MAX_BODY_CHARS || !title.trim() || !body.trim();
  const lighting = isBusy || planeLaunching;

  useEffect(() => {
    if (reduceMotion) return;
    const banner = bannerRef.current;
    const canvas = fireCanvasRef.current;
    if (!banner || !canvas) return;

    const inViewRef = { current: true };
    const handle = mountFireButton(banner, canvas, FIRE_BTN_PILL, {
      isActiveZone: () => false,
      shouldRun: () => inViewRef.current,
    });
    fireHandleRef.current = handle;
    handle?.setLit(false, 0.5, 'instant');

    let io: IntersectionObserver | null = null;
    if (handle && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          inViewRef.current = Boolean(entries[0]?.isIntersecting);
          handle.syncLoop();
        },
        { threshold: 0.05 }
      );
      io.observe(banner);
    }

    return () => {
      io?.disconnect();
      handle?.destroy();
      if (fireHandleRef.current === handle) fireHandleRef.current = null;
    };
  }, [reduceMotion]);

  useEffect(() => {
    fireHandleRef.current?.setLit(lighting, 0.5);
  }, [lighting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (overLimit || isBusy || submittingRef.current) return;
    submittingRef.current = true;
    triggerPlane();
    fireHandleRef.current?.setLit(true, 0.5);
    try {
      const ok = await onSubmitThread(title.trim(), body.trim());
      if (ok) {
        setTitle('');
        setBody('');
        onCancel();
      } else {
        fireHandleRef.current?.setLit(false, 0.5);
      }
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div className="panel-surface p-6 sm:p-8">
      <div
        ref={bannerRef}
        className={`composer-ignite-banner relative flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5 ${
          lighting ? 'is-lit' : ''
        }`}
      >
        {!reduceMotion && (
          <canvas ref={fireCanvasRef} className="composer-ignite-banner__fire" aria-hidden="true" />
        )}
        <div className="relative z-10 flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h2 className="type-title inline-flex items-center gap-2 text-ink">
            <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            {t('composerTitle')}
          </h2>
          <p className="type-caption inline-flex items-center gap-2.5 pl-0.5">
            <PeerAvatar
              avatarSeed={identity.avatarSeed}
              matrix={identity.identiconMatrix}
              size={22}
              label={identity.alias}
              fg={identity.fg}
              bg={identity.bg}
              animated={false}
            />
            {t('composerAs', { alias: identity.alias })}
          </p>
        </div>
        <motion.button
          whileTap={TAP}
          transition={TAP_TRANSITION}
          type="button"
          onClick={onCancel}
          className="relative z-10 inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-ctrl)] border border-border px-3 py-1.5 type-ui font-medium text-muted hover:bg-bg hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          {t('composerCancel')}
        </motion.button>
      </div>

      <form className="mt-5 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        <div>
          <label htmlFor="thread-title" className="type-label text-ink">
            {t('composerTitleLabel')}
          </label>
          <input
            id="thread-title"
            value={title}
            maxLength={MAX_TITLE_CHARS}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('composerTitlePlaceholder')}
            className="input-base mt-2"
            required
          />
        </div>
        <div>
          <label htmlFor="thread-body" className="type-label text-ink">
            {t('composerBodyLabel')}
          </label>
          <textarea
            id="thread-body"
            value={body}
            maxLength={MAX_BODY_CHARS}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder={t('composerBodyPlaceholder')}
            className="input-base mt-2 min-h-[7.5rem] resize-y"
            required
          />
        </div>
        <motion.button
          whileTap={!overLimit && !isBusy && !reduceMotion ? TAP : undefined}
          transition={TAP_TRANSITION}
          type="submit"
          disabled={overLimit || isBusy}
          className="btn-accent-sheen inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-5 py-2.5 type-ui font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <PlaneSendIcon
            planeKey={planeKey}
            launching={planeLaunching}
            busy={isBusy}
          />
          {isBusy && !planeLaunching ? t('composerPublishing') : t('composerPublish')}
        </motion.button>
      </form>
    </div>
  );
}
