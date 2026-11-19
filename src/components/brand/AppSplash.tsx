import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useT } from '../../i18n';
import { APP_SPLASH, DUR, EASE, ZONE_BOOT } from '../../motion/tokens';
import { haptic, HAPTIC_TAP } from '../../motion/haptic';
import { TaziaMark } from './TaziaMark';

function readSplashSeen(): boolean {
  try {
    return sessionStorage.getItem(APP_SPLASH.storageKey) === '1';
  } catch {
    return true;
  }
}

/** Survives React Strict Mode remount in the same page load. */
let splashClaimedThisLoad = false;

/** Claim once-per-session splash; also warms ZONE_BOOT so hero skips full ritual. */
function claimSplash(): boolean {
  if (splashClaimedThisLoad) return true;
  if (readSplashSeen()) return false;
  splashClaimedThisLoad = true;
  try {
    sessionStorage.setItem(APP_SPLASH.storageKey, '1');
    sessionStorage.setItem(ZONE_BOOT.storageKey, '1');
  } catch {
    /* ignore */
  }
  return true;
}

interface AppSplashProps {
  /** Prefer a shorter beat (invite deep-link, etc.). */
  short?: boolean;
}

/**
 * Cold-start full-screen mark — Telegram/Duolingo beat, once per session.
 * Blocks clicks while visible; respects prefers-reduced-motion.
 *
 * Choreography tokens live in APP_SPLASH (Motion transitions + UX timing band).
 */
export function AppSplash({ short = false }: AppSplashProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(() => claimSplash());
  const doneRef = useRef(false);
  const hapticRef = useRef(false);

  const finishMs = reduceMotion
    ? APP_SPLASH.reducedMs
    : short
      ? APP_SPLASH.shortMs
      : APP_SPLASH.finishMs;
  // Keep a readable hold; exit fade is owned by AnimatePresence only.
  // Exit stays shorter than enter (Material / NN/g); cap so short mode still fades cleanly.
  const exitMs = Math.min(APP_SPLASH.exitMs, Math.max(120, Math.floor(finishMs * 0.28)));
  const skipParts = Boolean(reduceMotion) || short;
  const { delay, partTweenDur, partSpring, stageSpring, stageOpacityDur, wordmarkDur } =
    APP_SPLASH;

  useEffect(() => {
    if (!open) return;

    const dismissAt = Math.max(0, finishMs - exitMs);

    const hapticTimer = window.setTimeout(() => {
      if (hapticRef.current || reduceMotion) return;
      hapticRef.current = true;
      haptic(HAPTIC_TAP);
    }, reduceMotion || short ? 40 : APP_SPLASH.hapticMs);

    const doneTimer = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      setOpen(false);
    }, dismissAt);

    return () => {
      window.clearTimeout(hapticTimer);
      window.clearTimeout(doneTimer);
    };
  }, [open, reduceMotion, short, finishMs, exitMs]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="app-splash"
          className="app-splash"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: exitMs / 1000, ease: EASE.easeIn }}
          aria-hidden="true"
        >
          <div className="app-splash__glow" />
          <motion.div
            className="app-splash__stage"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
            transition={
              reduceMotion
                ? { duration: DUR.tab, ease: EASE.outExpo }
                : {
                    opacity: { duration: stageOpacityDur, ease: EASE.outExpo },
                    scale: stageSpring,
                  }
            }
          >
            <TaziaMark
              size={APP_SPLASH.markPx}
              labelled={false}
              partMotion={
                skipParts
                  ? undefined
                  : {
                      outlineA: {
                        initial: { opacity: 0, scale: 0.94 },
                        animate: { opacity: 1, scale: 1 },
                        transition: {
                          duration: partTweenDur,
                          ease: EASE.outExpo,
                          delay: delay.outlineA,
                        },
                        style: { transformOrigin: '50% 50%' },
                      },
                      outlineB: {
                        initial: { opacity: 0, scale: 0.94 },
                        animate: { opacity: 1, scale: 1 },
                        transition: {
                          duration: partTweenDur,
                          ease: EASE.outExpo,
                          delay: delay.outlineB,
                        },
                        style: { transformOrigin: '50% 50%' },
                      },
                      island: {
                        initial: { opacity: 0, scale: 0.55, y: 12 },
                        animate: { opacity: 1, scale: 1, y: 0 },
                        transition: {
                          ...partSpring,
                          delay: delay.island,
                        },
                        style: { transformOrigin: '50% 60%' },
                      },
                      arrow: {
                        initial: { opacity: 0, x: -14, scale: 0.88 },
                        animate: { opacity: 1, x: 0, scale: 1 },
                        transition: {
                          ...partSpring,
                          delay: delay.arrow,
                        },
                        style: { transformOrigin: '20% 50%' },
                      },
                    }
              }
            />
            <motion.p
              className="app-splash__wordmark type-display"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{
                duration: reduceMotion ? DUR.micro : wordmarkDur,
                ease: EASE.outExpo,
                delay: skipParts ? 0.06 : delay.wordmark,
              }}
            >
              {t('brand')}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
