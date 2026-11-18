import { useState } from 'react';
import { Radio, ShieldAlert, Users, WifiOff, Wrench } from 'lucide-react';
import { useT } from '../../i18n';
import { clearIpConsent } from '../../core/utils/ipConsent';

export function HowItWorksView() {
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  const [forgetDone, setForgetDone] = useState(false);

  const steps = [
    t('helpSteps1'),
    t('helpSteps2'),
    t('helpSteps3'),
    t('helpSteps4'),
    t('helpSteps5'),
  ] as const;

  return (
    <main className="mx-auto max-w-[720px] px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
        {t('helpTitle')}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">{t('helpLede')}</p>

      <section className="mt-8" aria-labelledby="help-steps-title">
        <h2 id="help-steps-title" className="text-sm font-semibold text-ink">
          {t('helpStepsTitle')}
        </h2>
        <ol className="mt-3 space-y-2">
          {steps.map((label, i) => (
            <li
              key={label}
              className="flex gap-2.5 rounded-xl border border-border bg-surface-raised px-3 py-3 text-sm leading-snug text-muted"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent">
                {i + 1}
              </span>
              <span className="min-w-0 pt-0.5">{label}</span>
            </li>
          ))}
        </ol>
      </section>

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
        <li className="rounded-2xl border border-border bg-surface-raised p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <Wrench className="h-4 w-4 text-muted" aria-hidden="true" />
            {t('helpFixTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('helpFixBody')}</p>
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
