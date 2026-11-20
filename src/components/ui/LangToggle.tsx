import { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useLocale } from '../../i18n';
import { NAV_INDICATOR, TAP, TAP_TRANSITION } from '../../motion/tokens';

export interface LangToggleProps {
  className?: string;
}

const LOCALES = ['es', 'en'] as const;

export function LangToggle({ className = '' }: LangToggleProps) {
  const { locale, setLocale, t } = useLocale();
  const reduceMotion = useReducedMotion();
  const pillId = useId();

  return (
    <div
      role="group"
      aria-label={t('langToggleAria')}
      className={`inline-flex h-11 shrink-0 items-center rounded-[var(--radius-ctrl)] border border-border bg-surface p-0.5 ${className}`}
    >
      {LOCALES.map((code) => {
        const active = locale === code;
        const label = code === 'es' ? t('langEs') : t('langEn');

        return (
          <motion.button
            key={code}
            whileTap={!active && !reduceMotion ? TAP : undefined}
            transition={TAP_TRANSITION}
            type="button"
            lang={code}
            onClick={() => {
              if (!active) setLocale(code);
            }}
            aria-pressed={active}
            className={`relative inline-flex h-full min-w-[40px] cursor-pointer select-none items-center justify-center rounded-[calc(var(--radius-ctrl)-2px)] px-2 text-xs font-semibold transition-colors duration-[var(--dur-micro)] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              active ? 'text-on-accent' : 'text-muted hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`lang-pill-${pillId}`}
                aria-hidden="true"
                className="absolute inset-0 rounded-[calc(var(--radius-ctrl)-2px)] bg-accent"
                transition={reduceMotion ? { duration: 0.08 } : NAV_INDICATOR}
              />
            )}
            <span className="relative z-[1]">{label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}