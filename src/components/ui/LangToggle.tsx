import { motion } from 'motion/react';
import { useLocale } from '../../i18n';
import { NAV_INDICATOR, TAP, TAP_TRANSITION } from '../../motion/tokens';

export function LangToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      role="group"
      aria-label={t('langToggleAria')}
      className={`inline-flex h-11 shrink-0 items-center rounded-[var(--radius-ctrl)] border border-border bg-surface p-0.5 ${className}`}
    >
      {(['es', 'en'] as const).map((code) => (
        <motion.button
          key={code}
          whileTap={TAP}
          transition={TAP_TRANSITION}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`relative inline-flex h-full min-w-[40px] items-center justify-center rounded-[calc(var(--radius-ctrl)-2px)] px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            locale === code ? 'text-on-accent' : 'text-muted hover:text-ink'
          }`}
        >
          {locale === code && (
            <motion.span
              layoutId="lang-pill"
              className="absolute inset-0 rounded-[calc(var(--radius-ctrl)-2px)] bg-accent"
              transition={NAV_INDICATOR}
            />
          )}
          <span className="relative">{code === 'es' ? t('langEs') : t('langEn')}</span>
        </motion.button>
      ))}
    </div>
  );
}
