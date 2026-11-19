import { useRef, useState } from 'react';
import { Radio, ShieldAlert, Users, WifiOff, Wrench } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useT } from '../../i18n';
import { clearIpConsent } from '../../core/utils/ipConsent';
import {
  DUR,
  EASE,
  TAP,
  TAP_TRANSITION,
  listRowEnter,
  zoneBootReduced,
} from '../../motion/tokens';

export function HowItWorksView() {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);
  const [forgetDone, setForgetDone] = useState(false);
  /** Stagger steps only on first visit of this tab mount. */
  const stepsAnimatedRef = useRef(false);
  const animateSteps = !stepsAnimatedRef.current;
  if (!stepsAnimatedRef.current) stepsAnimatedRef.current = true;

  const steps = [
    t('helpSteps1'),
    t('helpSteps2'),
    t('helpSteps3'),
    t('helpSteps4'),
    t('helpSteps5'),
  ] as const;

  const infoBlocks = [
    { icon: Radio, titleKey: 'helpDirectTitle' as const, bodyKey: 'helpDirectBody' as const },
    { icon: Users, titleKey: 'helpGroupTitle' as const, bodyKey: 'helpGroupBody' as const },
    { icon: Radio, titleKey: 'helpZonesTitle' as const, bodyKey: 'helpZonesBody' as const },
    { icon: WifiOff, titleKey: 'helpRelayTitle' as const, bodyKey: 'helpRelayBody' as const },
    { icon: WifiOff, titleKey: 'helpNoServerTitle' as const, bodyKey: 'helpNoServerBody' as const },
    { icon: Wrench, titleKey: 'helpFixTitle' as const, bodyKey: 'helpFixBody' as const },
  ];

  return (
    <main className="mx-auto max-w-[720px] px-4 py-4 sm:px-8 sm:py-6">
      <h1 className="type-headline text-ink">{t('helpTitle')}</h1>
      <p className="type-lede mt-3">{t('helpLede')}</p>

      <section className="mt-8" aria-labelledby="help-steps-title">
        <h2 id="help-steps-title" className="text-sm font-semibold text-ink">
          {t('helpStepsTitle')}
        </h2>
        <ol className="mt-3 space-y-2">
          {steps.map((label, i) => (
            <motion.li
              key={label}
              initial={
                !animateSteps
                  ? false
                  : reduceMotion
                    ? zoneBootReduced.initial
                    : listRowEnter.initial
              }
              animate={
                reduceMotion ? zoneBootReduced.animate : listRowEnter.animate
              }
              transition={
                animateSteps && !reduceMotion
                  ? { delay: i * 0.05, duration: DUR.switch, ease: EASE.outExpo }
                  : undefined
              }
              className="list-row flex gap-2.5 px-3 py-3 text-sm leading-snug text-muted"
            >
              <span className="type-badge flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                {i + 1}
              </span>
              <span className="min-w-0 pt-0.5">{label}</span>
            </motion.li>
          ))}
        </ol>
      </section>

      <ul className="mt-8 space-y-6">
        {infoBlocks.map(({ icon: Icon, titleKey, bodyKey }) => (
          <li key={titleKey}>
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
              {t(titleKey)}
            </h2>
            <p className="type-lede mt-2">{t(bodyKey)}</p>
          </li>
        ))}
        <li className="rounded-[var(--radius-panel)] border border-warn-border bg-warn-bg p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-warn-ink">
            <ShieldAlert className="h-4 w-4 text-warn" aria-hidden="true" />
            {t('helpSafetyTitle')}
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[length:var(--type-body)] leading-[var(--leading-body)] text-warn-ink">
            <li>{t('helpSafety1')}</li>
            <li>{t('helpSafety2')}</li>
            <li>{t('helpSafety3')}</li>
            <li>{t('helpSafety4')}</li>
          </ul>
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
          <p className="type-caption mt-3 font-mono leading-relaxed whitespace-pre-line">
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
        <p className="type-caption mt-2">
          {forgetDone ? t('helpForgetDone') : t('helpForgetHint')}
        </p>
      </div>
    </main>
  );
}

export default HowItWorksView;
