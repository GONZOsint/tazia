import { useState } from 'react';
import { Radio, ShieldAlert, Users, WifiOff } from 'lucide-react';
import { useT } from '../../i18n';
import { clearIpConsent } from '../../core/utils/ipConsent';

export function HowItWorksView() {
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  const [forgetDone, setForgetDone] = useState(false);

  return (
    <main className="mx-auto max-w-[720px] px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
        {t('helpTitle')}
      </h1>
      <p className="mt-1 text-xs font-medium text-muted">
        {t('brand')} — {t('tagline')} / {t('taglineEn')}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">{t('helpLede')}</p>

      <ul className="mt-8 space-y-4">
        <li className="rounded-2xl border border-border bg-surface-raised p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <Radio className="h-4 w-4 text-muted" aria-hidden="true" />
            {t('helpDirectTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('helpDirectBody')}</p>
        </li>
        <li className="rounded-2xl border border-border bg-surface-raised p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <Users className="h-4 w-4 text-muted" aria-hidden="true" />
            {t('helpGroupTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('helpGroupBody')}</p>
        </li>
        <li className="rounded-2xl border border-warn-border bg-warn-bg p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-warn-ink">
            <ShieldAlert className="h-4 w-4 text-warn" aria-hidden="true" />
            {t('helpSafetyTitle')}
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-warn-ink">
            <li>{t('helpSafety1')}</li>
            <li>{t('helpSafety2')}</li>
            <li>{t('helpSafety3')}</li>
            <li>{t('helpSafety4')}</li>
          </ul>
        </li>
        <li className="rounded-2xl border border-border bg-surface-raised p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <WifiOff className="h-4 w-4 text-muted" aria-hidden="true" />
            {t('helpNoServerTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('helpNoServerBody')}</p>
        </li>
      </ul>

      <button
        type="button"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((v) => !v)}
        className="mt-6 min-h-[44px] text-sm font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {moreOpen ? t('helpMoreHide') : t('helpMore')}
      </button>
      {moreOpen && (
        <p className="mt-2 rounded-xl border border-border bg-bg p-4 text-xs leading-relaxed text-muted">
          {t('helpMoreBody')}
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-border bg-surface-raised p-5">
        <button
          type="button"
          onClick={() => {
            clearIpConsent();
            setForgetDone(true);
          }}
          className="inline-flex min-h-[44px] items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-bg"
        >
          {t('helpForgetDevice')}
        </button>
        <p className="mt-2 text-xs text-muted">
          {forgetDone ? t('helpForgetDone') : t('helpForgetHint')}
        </p>
      </div>
    </main>
  );
}

export default HowItWorksView;
