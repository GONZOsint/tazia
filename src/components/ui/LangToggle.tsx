import { useLocale } from '../../i18n';

export function LangToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      role="group"
      aria-label={t('langToggleAria')}
      className={`inline-flex rounded-lg border border-border bg-surface p-0.5 ${className}`}
    >
      <button
        type="button"
        onClick={() => setLocale('es')}
        aria-pressed={locale === 'es'}
        className={`min-h-[44px] min-w-[44px] rounded-md px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          locale === 'es' ? 'bg-accent text-on-accent' : 'text-muted'
        }`}
      >
        {t('langEs')}
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        className={`min-h-[44px] min-w-[44px] rounded-md px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          locale === 'en' ? 'bg-accent text-on-accent' : 'text-muted'
        }`}
      >
        {t('langEn')}
      </button>
    </div>
  );
}
