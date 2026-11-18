import { motion } from 'motion/react';
import { useLocale } from '../../i18n';

export function LangToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      role="group"
      aria-label={t('langToggleAria')}
      className={`inline-flex rounded-[var(--radius-ctrl)] border border-border bg-surface p-0.5 ${className}`}
    >
      {(['es', 'en'] as const).map((code) => (
        <motion.button
          key={code}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.12 }}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`relative min-h-[44px] min-w-[44px] rounded-md px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            locale === code ? 'text-on-accent' : 'text-muted'
          }`}
        >
          {locale === code && (
            <motion.span
              layoutId="lang-pill"
              className="absolute inset-0 rounded-md bg-accent"
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
          <span className="relative">{code === 'es' ? t('langEs') : t('langEn')}</span>
        </motion.button>
      ))}
    </div>
  );
}
