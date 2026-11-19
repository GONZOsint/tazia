import { useState } from 'react';
import { Radio, ShieldAlert, Users, WifiOff, Wrench } from 'lucide-react';
import { motion } from 'motion/react';
import { useT } from '../../i18n';
import { clearIpConsent } from '../../core/utils/ipConsent';
import { TAP, TAP_TRANSITION } from '../../motion/tokens';

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
              className="list-row flex gap-2.5 px-3 py-3 text-sm leading-snug text-muted"
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
        <li className="panel-surface p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <Radio className="h-4 w-4 text-muted" aria-hidden="true" />
            {t('helpDirectTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('helpDirectBody')}</p>
        </li>
        <li className="panel-surface p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <Users className="h-4 w-4 text-muted" aria-hidden="true" />
            {t('helpGroupTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('helpGroupBody')}</p>
        </li>
        <li className="panel-surface p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <Radio className="h-4 w-4 text-muted" aria-hidden="true" />
            {t('helpZonesTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('helpZonesBody')}</p>
        </li>
        <li className="panel-surface p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <WifiOff className="h-4 w-4 text-muted" aria-hidden="true" />
            {t('helpRelayTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('helpRelayBody')}</p>
        </li>
        <li className="rounded-[var(--radius-panel)] border border-warn-border bg-warn-bg p-5">
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
        <li className="panel-surface p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <WifiOff className="h-4 w-4 text-muted" aria-hidden="true" />
            {t('helpNoServerTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('helpNoServerBody')}</p>
        </li>
        <li className="panel-surface p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <Wrench className="h-4 w-4 text-muted" aria-hidden="true" />
            {t('helpFixTitle')}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t('helpFixBody')}</p>
        </li>
      </ul>

      <div className="mt-6 rounded-[var(--radius-panel)] border border-dashed border-border bg-bg/60 p-4">
        <motion.button
          whileTap={TAP}
          transition={TAP_TRANSITION}
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
          className="min-h-[44px] text-left text-sm font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {moreOpen ? t('helpMoreHide') : t('helpMore')}
        </motion.button>
        {moreOpen && (
          <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted whitespace-pre-line">
            {t('helpMoreBody')}
          </p>
        )}
      </div>

      <div className="mt-8 panel-surface p-5">
        <motion.button
          whileTap={TAP}
          transition={TAP_TRANSITION}
          type="button"
          onClick={() => {
            clearIpConsent();
            setForgetDone(true);
          }}
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-ctrl)] border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-bg focus-visible:outline-2 focus-visible:outline-accent"
        >
          {t('helpForgetDevice')}
        </motion.button>
        <p className="mt-2 text-xs text-muted">
          {forgetDone ? t('helpForgetDone') : t('helpForgetHint')}
        </p>
      </div>
    </main>
  );
}

export default HowItWorksView;
