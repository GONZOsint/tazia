import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Camera, KeyRound, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useQrScanner } from 'cam2qr/react';
import { useT } from '../../i18n';
import { DUR, EASE, TAP, TAP_TRANSITION, modalScrim, modalSheet } from '../../motion/tokens';
import { haptic, HAPTIC_TAP } from '../../motion/haptic';
import { parseInviteInput, type ParsedInvite } from '../../core/utils/inviteLink';

export interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (result: ParsedInvite) => void;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const emptySubscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

export function QrScannerModal({ open, onClose, onScan }: QrScannerModalProps) {
  const t = useT();
  const isClient = useIsClient();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const hintId = useId();

  const dialogRef = useRef<HTMLDivElement>(null);
  const pointerDownOnScrim = useRef(false);
  const pendingRef = useRef<ParsedInvite | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  const [success, setSuccess] = useState(false);

  const isOpenRef = useRef(open);
  isOpenRef.current = open;

  const successRef = useRef(success);
  successRef.current = success;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  // Reset success cleanly on re-open without flashing off during exit animation.
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setSuccess(false);
  }

  const handleDecode = useCallback((result: { text: string }) => {
    if (!isOpenRef.current || successRef.current || pendingRef.current) return;
    const parsed = parseInviteInput(result.text);
    if (!parsed) return;
    pendingRef.current = parsed;
    successRef.current = true;
    setSuccess(true);
    haptic(HAPTIC_TAP);
  }, []);

  const { videoRef, error } = useQrScanner({
    onDecode: handleDecode,
    enabled: open && !success,
  });

  useEffect(() => {
    if (!open || !success) return;
    const wait = Math.round(reduceMotion ? DUR.micro * 1000 : DUR.ritual * 1000 + 80);
    const timer = window.setTimeout(() => {
      const parsed = pendingRef.current;
      pendingRef.current = null;
      if (parsed) onScanRef.current(parsed);
      onCloseRef.current();
    }, wait);
    return () => window.clearTimeout(timer);
  }, [open, success, reduceMotion]);

  useEffect(() => {
    if (!open || !isClient) return;

    const previousActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    dialogRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!successRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (e.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusables = Array.from(
          dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => el.getClientRects().length > 0);

        if (focusables.length === 0) {
          e.preventDefault();
          dialog.focus();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || active === dialog || !dialog.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !dialog.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      pendingRef.current = null;
      successRef.current = false;
      if (
        previousActive &&
        typeof previousActive.focus === 'function' &&
        previousActive.isConnected
      ) {
        previousActive.focus({ preventScroll: true });
      }
    };
  }, [open, isClient]);

  const handleScrimPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    pointerDownOnScrim.current = e.target === e.currentTarget;
  };

  const handleScrimClick = (e: MouseEvent<HTMLDivElement>) => {
    const startedOnScrim = pointerDownOnScrim.current;
    pointerDownOnScrim.current = false;
    if (
      startedOnScrim &&
      e.target === e.currentTarget &&
      isOpenRef.current &&
      !successRef.current
    ) {
      onCloseRef.current();
    }
  };

  const handleClose = () => {
    if (!isOpenRef.current || successRef.current) return;
    onCloseRef.current();
  };

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="qr-scanner-modal"
          initial={modalScrim.initial}
          animate={modalScrim.animate}
          exit={modalScrim.exit}
          transition={modalScrim.transition}
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim-strong p-4"
          onPointerDown={handleScrimPointerDown}
          onClick={handleScrimClick}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={hintId}
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : modalSheet.initial}
            animate={reduceMotion ? { opacity: 1 } : modalSheet.animate}
            exit={reduceMotion ? { opacity: 0 } : modalSheet.exit}
            transition={reduceMotion ? { duration: 0.12 } : modalSheet.transition}
            className="panel-surface shadow-sheet relative max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto outline-none"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 id={titleId} className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                <Camera className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="truncate">{t('qrScanTitle')}</span>
              </h2>
              <motion.button
                whileTap={reduceMotion || success ? undefined : TAP}
                transition={TAP_TRANSITION}
                type="button"
                onClick={handleClose}
                disabled={success}
                className="icon-action icon-action--ghost shrink-0 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={t('consentCancel')}
                title={t('consentCancel')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </motion.button>
            </div>

            <div className="relative aspect-square w-full bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                autoPlay
                aria-hidden="true"
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
                        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.7 }}
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
              <p role="alert" className="px-4 py-3 text-center text-xs text-danger-ink">
                {t('qrScanError')}
              </p>
            )}

            <p id={hintId} className="px-4 py-3 text-center text-xs text-muted">
              {t('qrScanHint')}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default QrScannerModal;