import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useT } from '../../i18n';

interface IpConsentModalProps {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
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

export function IpConsentModal({ open, onAccept, onCancel }: IpConsentModalProps) {
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ip-consent-title"
      ref={dialogRef}
      tabIndex={-1}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="w-full max-w-md rounded-2xl border border-border bg-surface-raised p-5 shadow-lg sm:p-6"
      >
        <h2 id="ip-consent-title" className="font-display text-lg font-semibold text-ink">
          {t('consentTitle')}
        </h2>
        <IpExposureDiagram />
        <p className="mt-2 text-sm leading-relaxed text-muted">{t('consentBody')}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-muted hover:bg-bg"
          >
            {t('consentCancel')}
          </button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onAccept}
            className="min-h-[44px] rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90"
          >
            {t('consentAccept')}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
