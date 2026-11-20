import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useT } from '../../i18n';
import { TaziaLogo } from '../../components/brand/TaziaLogo';
import { FireBurnButton } from '../../components/session/FireBurnButton';
import { LangToggle } from '../../components/ui/LangToggle';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import {
  DUR,
  EASE,
  ZONE_BOOT,
  zoneBootCopy,
  zoneBootMark,
  zoneBootReduced,
} from '../../motion/tokens';

type IgniteLandingProps = {
  onIgnite: () => void;
  onHelp: () => void;
  /** Optional status banner (post-burn). */
  notice?: ReactNode;
};

/**
 * Pre-session welcome: one composition, one CTA (Encender llama).
 * Help is optional secondary — no tabs until the flame is lit.
 */
export function IgniteLanding({ onIgnite, onHelp, notice }: IgniteLandingProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-bg text-ink">
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-end gap-1.5 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8">
        <ThemeToggle />
        <LangToggle />
      </div>

      {notice ? (
        <div className="relative z-20 mx-auto mt-[calc(env(safe-area-inset-top,0px)+3.25rem)] w-full max-w-[1280px] px-4 sm:px-8">
          {notice}
        </div>
      ) : null}

      <section className="hero-landing relative flex flex-1 flex-col justify-center px-5 py-16 sm:px-10 sm:py-20">
        <div className="hero-glow zone-boot-glow" aria-hidden="true" />
        <div className="hero-landing__grid" aria-hidden="true" />

        <div className="relative z-[1] mx-auto flex max-w-md flex-col items-center text-center">
          <motion.div
            initial={reduceMotion ? zoneBootReduced.initial : zoneBootMark.initial}
            animate={reduceMotion ? zoneBootReduced.animate : zoneBootMark.animate}
            transition={reduceMotion ? zoneBootReduced.transition : zoneBootMark.transition}
            className="hero-landing-mark-wrap zone-boot-mark-ring"
          >
            <TaziaLogo size={88} className="hero-landing-mark relative z-[1]" />
          </motion.div>

          <motion.h1
            initial={reduceMotion ? zoneBootReduced.initial : zoneBootCopy.initial}
            animate={reduceMotion ? zoneBootReduced.animate : zoneBootCopy.animate}
            transition={{
              ...(reduceMotion ? zoneBootReduced.transition : zoneBootCopy.transition),
              delay: reduceMotion ? 0 : ZONE_BOOT.sparkMs / 1000,
            }}
            className="type-display mt-6 text-ink"
          >
            {t('brand')}
          </motion.h1>

          <motion.p
            initial={reduceMotion ? zoneBootReduced.initial : zoneBootCopy.initial}
            animate={reduceMotion ? zoneBootReduced.animate : zoneBootCopy.animate}
            transition={{
              ...(reduceMotion ? zoneBootReduced.transition : zoneBootCopy.transition),
              delay: reduceMotion ? 0 : ZONE_BOOT.glowMs / 1000,
            }}
            className="type-lede mt-3 max-w-sm text-balance"
          >
            {t('igniteBody')}
          </motion.p>

          <motion.div
            initial={reduceMotion ? zoneBootReduced.initial : zoneBootCopy.initial}
            animate={reduceMotion ? zoneBootReduced.animate : zoneBootCopy.animate}
            transition={{
              ...(reduceMotion ? zoneBootReduced.transition : zoneBootCopy.transition),
              delay: reduceMotion ? 0 : ZONE_BOOT.ctaAtMs / 1000,
            }}
            className="mt-10 flex flex-col items-center gap-5"
          >
            <div className="pb-10 pt-2">
              <FireBurnButton
                mode="ignite"
                forcePill
                label={t('igniteTab')}
                onClick={onIgnite}
              />
            </div>

            <button
              type="button"
              onClick={onHelp}
              className="type-meta text-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {t('igniteHelp')}
            </button>
          </motion.div>
        </div>
      </section>

      {/* Quiet reduced-motion friendly fade for the whole stage */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        initial={reduceMotion ? false : { opacity: 0.04 }}
        animate={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? DUR.micro : 0.6, ease: EASE.outExpo }}
      />
    </div>
  );
}
