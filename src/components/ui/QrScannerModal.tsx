import { useCallback, useEffect, useRef } from 'react';
import { Camera, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useQrScanner } from 'cam2qr/react';
import { useT } from '../../i18n';
import { DUR, EASE } from '../../motion/tokens';
import { parseInviteInput, type ParsedInvite } from '../../core/utils/inviteLink';

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (result: ParsedInvite) => void;
}

export function QrScannerModal({ open, onClose, onScan }: QrScannerModalProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleDecode = useCallback(
    (result: { text: string }) => {
      const parsed = parseInviteInput(result.text);
      if (parsed) {
        onScan(parsed);
        onClose();
      }
    },
    [onScan, onClose]
  );

  const { videoRef, error } = useQrScanner({
    onDecode: handleDecode,
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

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
          transition={{ duration: DUR.micro }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim-strong p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('roomsInvitePaste')}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: DUR.modal, ease: EASE.outExpo }}
            className="panel-surface relative w-full max-w-sm overflow-hidden outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Camera className="h-4 w-4 text-muted" aria-hidden="true" />
                {t('qrScanTitle')}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted focus-visible:outline-2 focus-visible:outline-accent"
                aria-label={t('consentCancel')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative aspect-square w-full bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                autoPlay
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-48 w-48 rounded-2xl border-2 border-accent/60" />
              </div>
            </div>

            {error && (
              <p className="px-4 py-3 text-center text-xs text-danger-ink">{t('qrScanError')}</p>
            )}

            <p className="px-4 py-3 text-center text-xs text-muted">{t('qrScanHint')}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default QrScannerModal;
