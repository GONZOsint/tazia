import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  Check,
  ChevronDown,
  EyeOff,
  Flame,
  Info,
  LayoutGrid,
  Radio,
  ShieldAlert,
  Users,
  Wrench,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useT } from '../../i18n';
import type { MessageKey } from '../../i18n';
import { clearIpConsent } from '../../core/utils/ipConsent';
import { clearTurnConfig } from '../rooms/TurnRelaySettings';
import { clearNostrRelayConfig } from '../rooms/nostrRelayConfig';
import {
  TAP,
  TAP_TRANSITION,
  listRowEnter,
  staggerChild,
  zoneBootReduced,
} from '../../motion/tokens';

const FORGET_CONFIRM_MS = 3500;
const FORGET_DONE_MS = 2600;

type IconComp = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

function HelpQuickSteps({ steps }: { steps: readonly string[] }) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const [active, setActive] = useState(1);

  const total = steps.length;
  const progress = total > 1 ? (active - 1) / (total - 1) : 1;
  const isLast = active === total;

  return (
    <section className="mt-8" aria-labelledby={titleId}>
      <div className="help-section-label">
        <h2 id={titleId}>{t('helpStepsTitle')}</h2>
        <span
          className={`help-step-hint ${isLast ? 'is-ember' : ''}`}
          aria-live="polite"
          aria-atomic="true"
        >
          {t('helpStepOf', { n: active, total })}
        </span>
      </div>

      <div className="help-steps">
        <div className="help-steps__track" aria-hidden="true">
          <div
            className="help-steps__fill"
            style={{ transform: `scaleY(${progress.toFixed(3)})` }}
          />
        </div>

        <ol className="help-steps__list">
          {steps.map((label, i) => {
            const n = i + 1;
            const reached = n <= active;
            const isActive = n === active;
            return (
              <motion.li
                key={i}
                initial={reduceMotion ? zoneBootReduced.initial : listRowEnter.initial}
                animate={reduceMotion ? zoneBootReduced.animate : listRowEnter.animate}
                transition={!reduceMotion ? staggerChild(i, 0.05).transition : undefined}
              >
                <button
                  type="button"
                  className={`help-step cursor-pointer select-none ${reached ? 'is-reached' : ''} ${
                    isActive ? 'is-active' : ''
                  } ${n === total ? 'is-burn' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => setActive(n)}
                  onFocus={() => setActive(n)}
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') setActive(n);
                  }}
                >
                  <span className="help-step__num" aria-hidden="true">
                    {n}
                  </span>
                  <span className="help-step__text">{label}</span>
                </button>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function HelpInfoCard({
  icon: Icon,
  title,
  body,
  pill,
  ember = false,
  children,
}: {
  icon: IconComp;
  title: string;
  body: string;
  pill?: string;
  ember?: boolean;
  children?: ReactNode;
}) {
  return (
    <article className={`help-card ${ember ? 'help-card--ember' : ''}`}>
      <div className="help-card__top">
        <div className="help-card__title-group">
          <span className="help-icon-badge" aria-hidden="true">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="help-card__title">{title}</h3>
        </div>
        {pill ? <span className="help-card__pill">{pill}</span> : null}
      </div>
      <p className="help-card__body">{body}</p>
      {children}
    </article>
  );
}

function HelpAccordion({
  title,
  icon: Icon,
  dashed = false,
  children,
}: {
  title: string;
  icon?: IconComp;
  dashed?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerId = useId();
  const panelId = useId();

  return (
    <div
      className={`help-accordion ${dashed ? 'help-accordion--dashed' : ''} ${open ? 'is-open' : ''}`}
    >
      <button
        id={triggerId}
        type="button"
        className="help-accordion__trigger cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="help-accordion__left">
          {Icon ? (
            <span className="help-icon-badge" aria-hidden="true">
              <Icon className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <span className="help-accordion__title">{title}</span>
        </span>
        <ChevronDown
          className={`chevron-spin h-[18px] w-[18px] shrink-0 text-muted ${open ? 'is-open' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        className="help-accordion__panel"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="help-accordion__inner">
          <div className="help-accordion__content">{children}</div>
        </div>
      </div>
    </div>
  );
}

function HelpForgetButton() {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<'idle' | 'confirming' | 'done'>('idle');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const reset = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setState('idle');
  };

  const label =
    state === 'confirming'
      ? t('helpForgetConfirm')
      : state === 'done'
        ? t('helpForgetDoneLabel')
        : t('helpForgetDevice');

  return (
    <section className="help-forget">
      <div className="help-forget__row">
        <motion.button
          whileTap={state === 'done' || reduceMotion ? undefined : TAP}
          transition={TAP_TRANSITION}
          type="button"
          aria-disabled={state === 'done' || undefined}
          className={`help-forget__btn select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            state === 'done' ? 'cursor-default' : 'cursor-pointer'
          } ${state === 'confirming' ? 'is-confirming' : ''} ${
            state === 'done' ? 'is-done' : ''
          }`}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && state === 'confirming') {
              e.stopPropagation();
              reset();
            }
          }}
          onClick={() => {
            if (state === 'idle') {
              setState('confirming');
              if (timerRef.current) window.clearTimeout(timerRef.current);
              timerRef.current = window.setTimeout(() => {
                timerRef.current = null;
                setState('idle');
              }, FORGET_CONFIRM_MS);
              return;
            }
            if (state === 'confirming') {
              if (timerRef.current) window.clearTimeout(timerRef.current);
              clearIpConsent();
              clearTurnConfig({ emitCleared: false });
              clearNostrRelayConfig();
              setState('done');
              timerRef.current = window.setTimeout(reset, FORGET_DONE_MS);
            }
          }}
        >
          <span>{label}</span>
          {state === 'confirming' ? (
            <span className="help-forget__timer" aria-hidden="true" />
          ) : null}
        </motion.button>
        <span
          className={`help-forget__status ${state === 'done' ? 'is-visible' : ''}`}
          role="status"
          aria-live="polite"
        >
          {state === 'done' ? t('helpForgetDone') : ''}
        </span>
      </div>
      <p className="help-forget__hint">{t('helpForgetHint')}</p>
    </section>
  );
}

const SAFETY_ITEMS: Array<{
  tone: 'warn' | 'safe';
  lead: MessageKey;
  body: MessageKey;
}> = [
  { tone: 'warn', lead: 'helpSafety1Lead', body: 'helpSafety1Body' },
  { tone: 'safe', lead: 'helpSafety2Lead', body: 'helpSafety2Body' },
  { tone: 'warn', lead: 'helpSafety3Lead', body: 'helpSafety3Body' },
  { tone: 'safe', lead: 'helpSafety4Lead', body: 'helpSafety4Body' },
  { tone: 'warn', lead: 'helpSafety5Lead', body: 'helpSafety5Body' },
];

const TECH_ROWS: Array<{ key: MessageKey; val: MessageKey }> = [
  { key: 'helpTechTransportKey', val: 'helpTechTransportVal' },
  { key: 'helpTechAuthKey', val: 'helpTechAuthVal' },
  { key: 'helpTechPersistKey', val: 'helpTechPersistVal' },
  { key: 'helpTechInviteKey', val: 'helpTechInviteVal' },
];

export function HowItWorksView() {
  const t = useT();
  const tribeTitleId = useId();
  const networkTitleId = useId();
  const safetyTitleId = useId();

  const steps = [
    t('helpStepsIgnite'),
    t('helpSteps1'),
    t('helpSteps2'),
    t('helpSteps3'),
    t('helpSteps4'),
    t('helpSteps5'),
  ] as const;

  const flowChips = [
    t('helpFlowIgnite'),
    t('helpFlowOpen'),
    t('helpFlowPhrase'),
    t('helpFlowQr'),
    t('helpFlowBurn'),
  ] as const;

  return (
    <main className="help-shell mx-auto max-w-[720px] px-4 py-4 sm:px-8 sm:py-6">
      <header className="help-header">
        <span className="help-eyebrow">
          <span className="help-eyebrow__dot" aria-hidden="true" />
          {t('helpEyebrow')}
        </span>
        <h1 className="type-headline text-ink">{t('helpTitle')}</h1>
        <p className="type-lede mt-3">{t('helpLede')}</p>
      </header>

      <HelpQuickSteps steps={steps} />

      <section className="mt-8" aria-labelledby={tribeTitleId}>
        <div className="help-section-label">
          <h2 id={tribeTitleId}>{t('helpTribeSection')}</h2>
        </div>
        <div className="help-cards">
          <HelpInfoCard
            icon={Radio}
            title={t('helpDirectTitle')}
            body={t('helpDirectBody')}
            pill={t('helpDirectPill')}
          />
          <HelpInfoCard
            icon={Users}
            title={t('helpGroupTitle')}
            body={t('helpGroupBody')}
            pill={t('helpGroupPill')}
          />
          <HelpInfoCard
            icon={Flame}
            title={t('helpDeleteTitle')}
            body={t('helpDeleteBody')}
            pill={t('helpDeletePill')}
            ember
          />
          <HelpInfoCard
            icon={LayoutGrid}
            title={t('helpZonesTitle')}
            body={t('helpZonesBody')}
            pill={t('helpZonesPill')}
          />
          <HelpInfoCard
            icon={EyeOff}
            title={t('helpNoServerTitle')}
            body={t('helpNoServerBody')}
          >
            <div className="help-flow" role="list">
              {flowChips.map((chip, i) => (
                <span key={i} className="contents">
                  {i > 0 ? (
                    <span className="help-flow__arrow" aria-hidden="true">
                      →
                    </span>
                  ) : null}
                  <span
                    role="listitem"
                    className={`help-flow__chip ${i === flowChips.length - 1 ? 'is-burn' : ''}`}
                  >
                    {chip}
                  </span>
                </span>
              ))}
            </div>
          </HelpInfoCard>
        </div>
      </section>

      <section className="mt-8" aria-labelledby={networkTitleId}>
        <div className="help-section-label">
          <h2 id={networkTitleId}>{t('helpNetworkSection')}</h2>
        </div>
        <HelpAccordion title={t('helpFixTitle')} icon={Wrench}>
          <div className="help-trouble">
            <p className="help-trouble__intro">{t('helpFixBody')}</p>
            <div className="help-trouble__step">
              <span className="help-trouble__num" aria-hidden="true">
                1
              </span>
              <p>
                <strong>{t('helpFixStep1Lead')}:</strong> {t('helpFixStep1Body')}
              </p>
            </div>
            <div className="help-trouble__step">
              <span className="help-trouble__num" aria-hidden="true">
                2
              </span>
              <p>
                <strong>{t('helpFixStep2Lead')}:</strong> {t('helpFixStep2Body')}
              </p>
            </div>
            <p className="help-trouble__note type-caption">{t('helpRelayBody')}</p>
          </div>
        </HelpAccordion>
      </section>

      <section className="help-safety mt-8" aria-labelledby={safetyTitleId}>
        <h2 className="help-safety__header" id={safetyTitleId}>
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('helpSafetyTitle')}</span>
        </h2>
        <div className="mb-4 rounded-[var(--radius-panel)] border border-border bg-bg px-4 py-3">
          <p className="type-label text-ink">{t('helpPrivacyTitle')}</p>
          <p className="type-caption mt-1 text-muted">{t('helpPrivacyBody')}</p>
          <p className="type-label mt-3 text-ink">{t('helpOfflineTitle')}</p>
          <p className="type-caption mt-1 text-muted">{t('helpOfflineBody')}</p>
        </div>
        <ul className="help-safety__list">
          {SAFETY_ITEMS.map(({ tone, lead, body }) => (
            <li key={lead} className="help-safety__item">
              <span
                className={`help-safety__badge help-safety__badge--${tone}`}
                aria-hidden="true"
              >
                {tone === 'safe' ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                ) : (
                  <Info className="h-2.5 w-2.5" strokeWidth={3} />
                )}
              </span>
              <span>
                <strong>{t(lead)}:</strong> {t(body)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6">
        <HelpAccordion title={t('helpMore')} dashed>
          <div className="help-tech">
            {TECH_ROWS.map(({ key, val }) => (
              <div key={key} className="help-tech__row">
                <span className="help-tech__key">{t(key)}</span>
                <span className="help-tech__val">{t(val)}</span>
              </div>
            ))}
            <p className="help-tech__docs type-caption">{t('helpMoreBody')}</p>
          </div>
        </HelpAccordion>
      </div>

      <div className="mt-8">
        <HelpForgetButton />
      </div>
    </main>
  );
}

export default HowItWorksView;