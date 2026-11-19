import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, KeyRound, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useQrScanner } from 'cam2qr/react';
import { useT } from '../../i18n';
import { DUR, EASE, TAP, TAP_TRANSITION, modalScrim, modalSheet } from '../../motion/tokens';
import { parseInviteInput, type ParsedInvite } from '../../core/utils/inviteLink';

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (result: ParsedInvite) => void;
}

export function QrScannerModal({ open, onClose, onScan }: QrScannerModalProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [success, setSuccess] = useState(false);
  const pendingRef = useRef<ParsedInvite | null>(null);

  useEffect(() => {
    if (!open) {
      setSuccess(false);
      pendingRef.current = null;
    }
  }, [open]);

  const finishSuccess = useCallback(() => {
    const parsed = pendingRef.current;
    pendingRef.current = null;
    if (parsed) onScan(parsed);
    onClose();
  }, [onScan, onClose]);

  const handleDecode = useCallback(
    (result: { text: string }) => {
      if (success || pendingRef.current) return;
      const parsed = parseInviteInput(result.text);
      if (!parsed) return;
      pendingRef.current = parsed;
      setSuccess(true);
      const wait = reduceMotion ? DUR.micro * 1000 : DUR.ritual * 1000 + 80;
      window.setTimeout(finishSuccess, wait);
    },
    [success, reduceMotion, finishSuccess]
  );

  const { videoRef, error } = useQrScanner({
    onDecode: handleDecode,
    enabled: open && !success,
  });

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !success) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose, success]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={modalScrim.initial}
          animate={modalScrim.animate}
          exit={modalScrim.exit}
          transition={modalScrim.transition}
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim-strong p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('roomsInvitePaste')}
          onClick={success ? undefined : onClose}
        >
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={modalSheet.initial}
            animate={modalSheet.animate}
            exit={modalSheet.exit}
            transition={modalSheet.transition}
            className="panel-surface shadow-sheet relative w-full max-w-sm overflow-hidden outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Camera className="h-4 w-4 text-muted" aria-hidden="true" />
                {t('qrScanTitle')}
              </div>
              <motion.button
                whileTap={TAP}
                transition={TAP_TRANSITION}
                type="button"
                onClick={onClose}
                disabled={success}
                className="icon-action icon-action--ghost focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                aria-label={t('consentCancel')}
              >
                <X className="h-4 w-4" />
              </motion.button>
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
                <div className="relative h-48 w-48 rounded-[var(--radius-sheet)] border-2 border-accent/60">
                  {success && (
                    <>
                      <span
                        className="qr-success-ring absolute inset-0 rounded-[var(--radius-sheet)] border-2 border-accent"
                        aria-hidden="true"
                      />
                      <motion.span
                        className="absolute inset-0 flex items-center justify-center"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={
                          reduceMotion
                            ? { duration: DUR.micro }
                            : { ...EASE.ritualSpring }
                        }
                      >
                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg">
                          <KeyRound className="h-7 w-7" aria-hidden="true" />
                        </span>
                      </motion.span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {error && !success && (
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
