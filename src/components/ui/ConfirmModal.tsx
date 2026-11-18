import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
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
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          ref={dialogRef}
          tabIndex={-1}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-[var(--radius-sheet)] border border-border bg-surface-raised p-5 shadow-lg sm:p-6"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" aria-hidden="true" strokeWidth={1.75} />
              <div>
                <h2 id="confirm-title" className="font-display text-lg font-semibold text-ink">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.12 }}
                type="button"
                onClick={onCancel}
                className="min-h-[44px] rounded-[var(--radius-ctrl)] border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-muted hover:bg-bg focus-visible:outline-2 focus-visible:outline-accent"
              >
                {cancelLabel ?? t('consentCancel')}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.12 }}
                type="button"
                onClick={onConfirm}
                className="min-h-[44px] rounded-[var(--radius-ctrl)] bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent"
              >
                {confirmLabel ?? t('consentAccept')}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
