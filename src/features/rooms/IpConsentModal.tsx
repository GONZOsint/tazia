import { useEffect, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useT } from '../../i18n';

interface IpConsentModalProps {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
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
        className="w-full max-w-md rounded-2xl border border-border bg-surface-raised p-5 shadow-lg sm:p-6"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden="true" />
          <div>
            <h2 id="ip-consent-title" className="font-display text-lg font-semibold text-ink">
              {t('consentTitle')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t('consentBody')}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-muted hover:bg-bg"
          >
            {t('consentCancel')}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="min-h-[44px] rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90"
          >
            {t('consentAccept')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
