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
        className={`min-h-[36px] min-w-[40px] rounded-md px-2 text-xs font-semibold ${
          locale === 'es' ? 'bg-accent text-on-accent' : 'text-muted'
        }`}
      >
        {t('langEs')}
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        className={`min-h-[36px] min-w-[40px] rounded-md px-2 text-xs font-semibold ${
          locale === 'en' ? 'bg-accent text-on-accent' : 'text-muted'
        }`}
      >
        {t('langEn')}
      </button>
    </div>
  );
}
