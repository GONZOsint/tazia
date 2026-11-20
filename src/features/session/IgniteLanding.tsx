import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useT } from '../../i18n';
import {
  splashCopyHandoffMs,
  splashCoveredIntroThisLoad,
} from '../../components/brand/AppSplash';
import { TaziaMark } from '../../components/brand/TaziaMark';
import { FireBurnButton } from '../../components/session/FireBurnButton';
import { LangToggle } from '../../components/ui/LangToggle';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import {
  APP_SPLASH,
  contentSwitch,
  EASE,
  zoneBootCopy,
  zoneBootCta,
  zoneBootMark,
  zoneBootMarkShort,
  zoneBootReduced,
} from '../../motion/tokens';
import {
  IGNITE_BURN_BRAND_FADE_MS,
  IGNITE_BURN_BTN_FADE_MS,
  IGNITE_BURN_START_MS,
  IGNITE_REDUCED_MS,
  mountIgniteBurn,
  type IgniteBurnHandle,
} from '../../motion/igniteBurn';

const HowItWorksView = lazy(() => import('../how/HowItWorksView'));

/** After mark settles, bring in title / copy / CTAs. */
const INTRO_COPY_AT_MS = 720;
const INTRO_COPY_AT_REDUCED_MS = 120;

type IntroBoot = 'mark' | 'ready';
type IgnitePhase = 'idle' | 'starting' | 'burning-btn' | 'burning-brand' | 'done';

type IgniteLandingProps = {
  onIgnite: () => void;
  onReveal: () => void;
};

/**
 * Intro choreography:
 * 1) Logo enters in the shared splash center seat and holds
 * 2) Same logo stays; TAZIA + body + buttons enter around it
 * 3) Light flame → burn screen + logo → zones
 */
export function IgniteLanding({ onIgnite, onReveal }: IgniteLandingProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const handoffFromSplash = splashCoveredIntroThisLoad();
  const frameRef = useRef<HTMLDivElement>(null);
  const btnWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const burnRef = useRef<IgniteBurnHandle | null>(null);
  const timersRef = useRef<number[]>([]);
  const [boot, setBoot] = useState<IntroBoot>('mark');
  const [phase, setPhase] = useState<IgnitePhase>('idle');
  const [helpOpen, setHelpOpen] = useState(false);
  const phaseRef = useRef<IgnitePhase>('idle');
  phaseRef.current = phase;

  const clearTimers = () => {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  };

  const schedule = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = mountIgniteBurn(canvas, {
      getFrameEl: () => frameRef.current,
      getOriginBtn: () =>
        (btnWrapRef.current?.querySelector('.fire-btn') as HTMLElement | null) ?? null,
    });
    burnRef.current = handle;
    handle?.drawIdle();
    return () => {
      clearTimers();
      handle?.destroy();
      burnRef.current = null;
    };
  }, []);

  useEffect(() => {
    // After splash: wait until cream wordmark has cleared, then rise white copy.
    const ms = handoffFromSplash
      ? splashCopyHandoffMs()
      : reduceMotion
        ? INTRO_COPY_AT_REDUCED_MS
        : INTRO_COPY_AT_MS;
    const id = window.setTimeout(() => setBoot('ready'), ms);
    return () => window.clearTimeout(id);
  }, [reduceMotion, handoffFromSplash]);

  const finishWithExit = () => {
    setPhase('done');
    // Dismiss overlay — session already lit on onReveal so TopBar fire is mounted.
    onIgnite();
  };

  const finishFast = () => {
    setPhase('burning-btn');
    onReveal();
    schedule(() => setPhase('burning-brand'), 80);
    schedule(() => {
      setPhase('done');
      onIgnite();
    }, IGNITE_REDUCED_MS);
  };

  const startRitual = () => {
    if (phaseRef.current !== 'idle' || helpOpen || boot !== 'ready') return;
    setPhase('starting');
    clearTimers();

    if (reduceMotion || !burnRef.current) {
      finishFast();
      return;
    }

    let completed = false;
    const complete = () => {
      if (completed) return;
      completed = true;
      finishWithExit();
    };

    schedule(() => {
      const handle = burnRef.current;
      if (!handle) {
        complete();
        return;
      }
      handle.start({ onComplete: complete });
    }, IGNITE_BURN_START_MS);

    schedule(complete, IGNITE_BURN_START_MS + 2_400);

    schedule(() => {
      setPhase('burning-btn');
      onReveal();
    }, IGNITE_BURN_BTN_FADE_MS);

    schedule(() => {
      setPhase('burning-brand');
    }, IGNITE_BURN_BRAND_FADE_MS);
  };

  const overlayClass = [
    'ignite-overlay',
    phase === 'starting' || phase === 'burning-btn' || phase === 'burning-brand' || phase === 'done'
      ? 'is-starting'
      : '',
    phase === 'burning-btn' || phase === 'burning-brand' || phase === 'done'
      ? 'is-burning-btn'
      : '',
    phase === 'burning-brand' || phase === 'done' ? 'is-burning-brand' : '',
    phase === 'done' ? 'is-done' : '',
    helpOpen ? 'is-help' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const busy = phase !== 'idle';
  const canAct = boot === 'ready' && !busy && !helpOpen;
  const markMotion = reduceMotion
    ? zoneBootReduced
    : handoffFromSplash
      ? zoneBootMarkShort
      : zoneBootMark;
  const copyMotion = reduceMotion ? zoneBootReduced : zoneBootCopy;
  const ctaMotion = reduceMotion ? zoneBootReduced : zoneBootCta;
  const btnLeaving = phase !== 'idle';
  const brandLeaving = phase === 'burning-brand' || phase === 'done';

  return (
    <div
      ref={frameRef}
      className={overlayClass}
      aria-hidden={phase === 'done' ? true : undefined}
    >
      <canvas ref={canvasRef} className="burn-canvas" aria-hidden="true" />

      <motion.div
        initial={false}
        animate={
          boot === 'ready' && !btnLeaving
            ? { opacity: 1 }
            : { opacity: 0 }
        }
        transition={{
          duration: reduceMotion ? 0.16 : 0.42,
          ease: EASE.outExpo,
          delay: boot === 'ready' && !reduceMotion ? 0.08 : 0,
        }}
        className="ignite-overlay__chrome absolute inset-x-0 top-0 z-[5] flex items-center justify-end gap-1.5 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8"
        aria-hidden={boot !== 'ready' || btnLeaving ? true : undefined}
      >
        <ThemeToggle />
        <LangToggle />
      </motion.div>

      <div className="brand-intro-layout">
        <div className="brand-intro-cluster intro-brand">
          <motion.div
            initial={markMotion.initial}
            animate={
              brandLeaving
                ? { opacity: 0, y: -10, scale: 0.98 }
                : markMotion.animate
            }
            transition={
              brandLeaving
                ? { duration: 0.62, ease: EASE.outExpo }
                : markMotion.transition
            }
            className="brand-intro-cluster__mark"
          >
            <TaziaMark
              size={APP_SPLASH.markPx}
              labelled
              ariaLabel={t('brand')}
              className="intro-mark"
            />
          </motion.div>

          <div
            className="intro-copy-block"
            aria-hidden={boot !== 'ready' || brandLeaving ? true : undefined}
          >
            <motion.h1
              className="intro-heading"
              initial={false}
              animate={
                brandLeaving
                  ? { opacity: 0, y: -8 }
                  : boot === 'ready'
                    ? copyMotion.animate
                    : reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: 5 }
              }
              transition={
                brandLeaving
                  ? { duration: 0.48, ease: EASE.outExpo }
                  : copyMotion.transition
              }
            >
              {t('brand')}
            </motion.h1>
            <motion.p
              className="intro-copy mx-auto mt-2.5"
              initial={false}
              animate={
                brandLeaving
                  ? { opacity: 0, y: -6 }
                  : boot === 'ready'
                    ? copyMotion.animate
                    : reduceMotion
                      ? { opacity: 0 }
                      : { opacity: 0, y: 5 }
              }
              transition={
                brandLeaving
                  ? { duration: 0.42, ease: EASE.outExpo }
                  : {
                      ...copyMotion.transition,
                      delay:
                        boot === 'ready' && !reduceMotion
                          ? 0.09
                          : 0,
                    }
              }
            >
              {t('igniteBody')}
            </motion.p>
          </div>
        </div>

        {/* Motion owns opacity — CSS class fade loses to Motion inline styles. */}
        <motion.div
          ref={btnWrapRef}
          initial={false}
          animate={
            btnLeaving
              ? { opacity: 0, y: -8, scale: 0.98 }
              : boot === 'ready'
                ? ctaMotion.animate
                : reduceMotion
                  ? { opacity: 0 }
                  : ctaMotion.initial
          }
          transition={
            btnLeaving
              ? { duration: reduceMotion ? 0.18 : 0.52, ease: EASE.outExpo }
              : ctaMotion.transition
          }
          className="intro-btn-wrap"
          aria-hidden={boot !== 'ready' || btnLeaving ? true : undefined}
        >
          <FireBurnButton
            mode="ignite"
            forcePill
            label={t('igniteTab')}
            disabled={!canAct}
            pointerActive={canAct}
            onClick={() => startRitual()}
          />
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            disabled={!canAct}
            className="type-meta text-white/55 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-40"
          >
            {t('igniteHelp')}
          </button>
        </motion.div>
      </div>

      <AnimatePresence initial={false}>
        {helpOpen ? (
          <motion.div
            key="ignite-help"
            role="dialog"
            aria-modal="true"
            aria-label={t('igniteHelp')}
            initial={reduceMotion ? { opacity: 0 } : contentSwitch.initial}
            animate={reduceMotion ? { opacity: 1 } : contentSwitch.animate}
            exit={reduceMotion ? { opacity: 0 } : contentSwitch.exit}
            transition={contentSwitch.transition}
            className="ignite-help absolute inset-0 z-[8] flex flex-col bg-bg text-ink"
          >
            <div className="relative z-10 flex shrink-0 items-center gap-2 border-b border-border bg-bg px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="inline-flex min-h-[44px] cursor-pointer select-none items-center gap-1.5 rounded-[var(--radius-ctrl)] px-2 type-ui font-semibold text-ink hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
                {t('igniteHelpBack')}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Suspense
                fallback={
                  <div className="mx-auto max-w-[720px] space-y-4 px-4 py-8 sm:px-8" aria-busy="true">
                    <div className="panel-surface h-24 animate-pulse" />
                    <div className="panel-surface h-40 animate-pulse" />
                  </div>
                }
              >
                <HowItWorksView />
              </Suspense>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
