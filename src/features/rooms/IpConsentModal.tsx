import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { TAP, TAP_TRANSITION, modalScrim, modalSheet } from '../../motion/tokens';

interface IpConsentModalProps {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
  /** Close modal and jump to Zones → Fix (TURN / Nostr). */
  onOpenFix?: () => void;
}

function IpExposureDiagram() {
  return (
    <svg
      viewBox="0 0 280 88"
      className="mx-auto mt-4 w-full max-w-sm text-ink"
      role="img"
      aria-hidden="true"
    >
      <circle cx="48" cy="44" r="22" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-80" />
      <circle cx="48" cy="38" r="7" fill="currentColor" className="opacity-70" />
      <path
        d="M34 58c4-8 24-8 28 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="opacity-70"
      />
      <path
        d="M78 44h124"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        className="opacity-50"
      />
      <polygon points="198,44 188,39 188,49" fill="currentColor" className="opacity-60" />
      <circle cx="232" cy="28" r="12" fill="none" stroke="currentColor" strokeWidth="1.25" className="opacity-55" />
      <circle cx="232" cy="44" r="12" fill="none" stroke="currentColor" strokeWidth="1.25" className="opacity-55" />
      <circle cx="232" cy="60" r="12" fill="none" stroke="currentColor" strokeWidth="1.25" className="opacity-55" />
      <text x="48" y="82" textAnchor="middle" className="fill-current text-[10px] opacity-50">
        IP
      </text>
    </svg>
  );
}

export function IpConsentModal({ open, onAccept, onCancel, onOpenFix }: IpConsentModalProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onCancel]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={modalScrim.initial}
          animate={modalScrim.animate}
          exit={modalScrim.exit}
          transition={modalScrim.transition}
          className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-4 sm:items-center"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ip-consent-title"
          onClick={onCancel}
        >
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={modalSheet.initial}
            animate={modalSheet.animate}
            exit={modalSheet.exit}
            transition={modalSheet.transition}
            className="panel-surface panel-pad--modal shadow-sheet w-full max-w-md outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="ip-consent-title" className="type-title text-ink">
              {t('consentTitle')}
            </h2>
            <IpExposureDiagram />
            <p className="type-lede mt-2">{t('consentBody')}</p>
            <p className="type-caption mt-3 text-muted">{t('consentHideIpNote')}</p>
            <div className="mt-5 flex flex-col gap-2">
              <motion.button
                whileTap={TAP}
                transition={TAP_TRANSITION}
                type="button"
                onClick={onAccept}
                className="btn-accent-sheen inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-ctrl)] bg-accent px-4 py-2.5 type-ui font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent"
              >
                {t('consentAccept')}
              </motion.button>
              <div className={`grid gap-2 ${onOpenFix ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                <motion.button
                  whileTap={TAP}
                  transition={TAP_TRANSITION}
                  type="button"
                  onClick={onCancel}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-ctrl)] border border-border bg-bg px-4 py-2 type-ui font-medium text-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {t('consentCancel')}
                </motion.button>
                {onOpenFix ? (
                  <motion.button
                    whileTap={TAP}
                    transition={TAP_TRANSITION}
                    type="button"
                    onClick={onOpenFix}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-ctrl)] border border-border bg-bg px-4 py-2 text-center type-ui font-medium text-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {t('consentOpenFix')}
                  </motion.button>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
