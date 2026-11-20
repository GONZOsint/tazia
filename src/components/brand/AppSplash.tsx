import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from 'motion/react';
import { useT } from '../../i18n';
import { APP_SPLASH, ZONE_BOOT } from '../../motion/tokens';
import { haptic, HAPTIC_TAP } from '../../motion/haptic';
import { SplashMark } from './SplashMark';
import { TaziaMark } from './TaziaMark';

/** True solo si esta carga de página realmente mostró AppSplash. */
let splashShownThisLoad = false;
/** True cuando ya se resolvió (visto previamente en sessionStorage o ya cerrado). */
let splashSettledThisLoad = false;
/** Ignite copy reveal delay for this load (full / short / reduced). */
let splashCopyHandoffMsThisLoad: number = APP_SPLASH.copyHandoffMs;

function readSplashSeen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return sessionStorage.getItem(APP_SPLASH.storageKey) === '1';
  } catch {
    return true;
  }
}

/**
 * True únicamente cuando esta carga mostró AppSplash sobre IgniteLanding.
 * Nota: AppSplash debe renderizarse antes que IgniteLanding en el árbol
 * para que Ignite lea el valor actualizado en su primer render.
 */
export function splashCoveredIntroThisLoad(): boolean {
  return splashShownThisLoad;
}

/** Ms from mount when Ignite may reveal copy after this load’s splash. */
export function splashCopyHandoffMs(): number {
  return splashCopyHandoffMsThisLoad;
}

function resolveCopyHandoffMs(short: boolean, reduced: boolean): number {
  if (reduced) {
    const exit = APP_SPLASH.reducedExitMs;
    return APP_SPLASH.reducedMs - exit + Math.round(exit * 0.45);
  }
  if (short) {
    const exit = APP_SPLASH.shortExitMs;
    return APP_SPLASH.shortMs - exit + Math.round(exit * 0.45);
  }
  return APP_SPLASH.copyHandoffMs;
}

function claimSplash(): boolean {
  if (splashSettledThisLoad) return false;
  if (splashShownThisLoad) return true;

  if (readSplashSeen()) {
    splashSettledThisLoad = true;
    return false;
  }

  splashShownThisLoad = true;
  try {
    sessionStorage.setItem(APP_SPLASH.storageKey, '1');
    sessionStorage.setItem(ZONE_BOOT.storageKey, '1');
  } catch {
    /* ignore storage quota / private mode errors */
  }
  return true;
}

interface AppSplashProps {
  short?: boolean;
  onExitComplete?: () => void;
  /** True while the splash veil is open (for inert/aria-hidden on shell). */
  onActiveChange?: (active: boolean) => void;
}

export function AppSplash({
  short = false,
  onExitComplete,
  onActiveChange,
}: AppSplashProps) {
  const [open, setOpen] = useState(() => claimSplash());

  useLayoutEffect(() => {
    onActiveChange?.(open);
    return () => onActiveChange?.(false);
  }, [open, onActiveChange]);

  const handleDismiss = () => {
    splashSettledThisLoad = true;
    setOpen(false);
  };

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <SplashOverlay
          key="app-splash"
          short={short}
          onDismiss={handleDismiss}
        />
      )}
    </AnimatePresence>
  );
}

interface SplashOverlayProps {
  short: boolean;
  onDismiss: () => void;
}

/** Accelerated exit — matches splash mock curve-exit. */
const EXIT_EASE = [0.3, 0, 0.8, 0.15] as const;

function SplashOverlay({ short, onDismiss }: SplashOverlayProps) {
  const t = useT();
  const wordmarkId = useId();
  const isPresent = useIsPresent();
  const prefersReduced = Boolean(useReducedMotion());

  const mountTimeRef = useRef<number | null>(null);
  const hapticFiredRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const finishMs = prefersReduced
    ? APP_SPLASH.reducedMs
    : short
      ? APP_SPLASH.shortMs
      : APP_SPLASH.finishMs;

  const exitMs = prefersReduced
    ? APP_SPLASH.reducedExitMs
    : short
      ? APP_SPLASH.shortExitMs
      : APP_SPLASH.exitMs;

  const exitSec = exitMs / 1000;
  const skipChoreography = prefersReduced || short;

  useLayoutEffect(() => {
    splashCopyHandoffMsThisLoad = resolveCopyHandoffMs(short, prefersReduced);
  }, [short, prefersReduced]);

  useEffect(() => {
    if (mountTimeRef.current === null) {
      mountTimeRef.current = performance.now();
    }

    const elapsed = performance.now() - mountTimeRef.current;
    const dismissAt = Math.max(80, finishMs - exitMs);
    const remainingDismiss = Math.max(0, dismissAt - elapsed);

    let hapticTimer: number | undefined;
    if (!prefersReduced && !hapticFiredRef.current) {
      const targetHapticMs = short ? 40 : APP_SPLASH.hapticMs;
      const remainingHaptic = Math.max(0, targetHapticMs - elapsed);
      hapticTimer = window.setTimeout(() => {
        if (hapticFiredRef.current) return;
        hapticFiredRef.current = true;
        haptic(HAPTIC_TAP);
      }, remainingHaptic);
    }

    const doneTimer = window.setTimeout(() => {
      onDismissRef.current();
    }, remainingDismiss);

    return () => {
      if (hapticTimer !== undefined) window.clearTimeout(hapticTimer);
      window.clearTimeout(doneTimer);
    };
  }, [prefersReduced, short, finishMs, exitMs]);

  return (
    <motion.div
      className={`app-splash${skipChoreography ? ' app-splash--static' : ' app-splash--play'}`}
      style={{ pointerEvents: isPresent ? 'auto' : 'none' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        transition: { duration: exitSec, ease: EXIT_EASE },
      }}
      role="group"
      aria-labelledby={wordmarkId}
    >
      <motion.div
        className="app-splash__stage"
        exit={
          prefersReduced
            ? undefined
            : {
                opacity: 0,
                scale: 1.07,
                transition: { duration: exitSec * 0.9, ease: EXIT_EASE },
              }
        }
      >
        <div className="app-splash__glow" aria-hidden="true" />

        <div className="brand-intro-layout">
          <div className="brand-intro-cluster">
            <div className="brand-intro-cluster__mark">
              {skipChoreography ? (
                <TaziaMark size={APP_SPLASH.markPx} labelled={false} />
              ) : (
                <SplashMark size={APP_SPLASH.markPx} />
              )}
            </div>

            <div className="intro-copy-block">
              <p id={wordmarkId} className="app-splash__wordmark">
                {t('brand')}
              </p>
            </div>
          </div>
          <div className="intro-btn-wrap app-splash__cta-slot" aria-hidden="true" />
        </div>
      </motion.div>
    </motion.div>
  );
}
