import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useT } from '../../i18n';
import { TAP, TAP_TRANSITION, modalScrim, modalSheet } from '../../motion/tokens';
import { AccentButton, SecondaryButton } from './AccentButton';

export interface ConfirmModalProps {
  open: boolean;
  title: ReactNode;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirm (burn / leave) — danger styling. */
  danger?: boolean;
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }> | null;
  /** Optional controls between body and actions (e.g. forget-TURN checkbox). */
  extra?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
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

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger = false,
  icon: Icon = AlertTriangle,
  extra,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const t = useT();
  const isClient = useIsClient();
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const descId = useId();

  const dialogRef = useRef<HTMLDivElement>(null);
  const pointerDownOnScrim = useRef(false);
  const [confirming, setConfirming] = useState(false);

  const isOpenRef = useRef(open);
  isOpenRef.current = open;

  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  useEffect(() => {
    if (!open || !isClient) return;

    const previousActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    dialogRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancelRef.current();
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
    if (startedOnScrim && e.target === e.currentTarget && isOpenRef.current) {
      onCancelRef.current();
    }
  };

  const handleCancel = () => {
    if (!isOpenRef.current) return;
    onCancelRef.current();
  };

  const handleConfirm = () => {
    if (!isOpenRef.current || confirming) return;
    setConfirming(true);
    onConfirm();
  };

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="confirm-modal"
          initial={modalScrim.initial}
          animate={modalScrim.animate}
          exit={modalScrim.exit}
          transition={modalScrim.transition}
          className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-4 sm:items-center"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          onPointerDown={handleScrimPointerDown}
          onClick={handleScrimClick}
        >
          <motion.div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : modalSheet.initial}
            animate={reduceMotion ? { opacity: 1 } : modalSheet.animate}
            exit={reduceMotion ? { opacity: 0 } : modalSheet.exit}
            transition={reduceMotion ? { duration: 0.12 } : modalSheet.transition}
            className={`shadow-sheet panel-pad--modal w-full max-w-md rounded-[var(--radius-sheet)] border bg-surface-raised outline-none ${
              danger ? 'border-danger-border' : 'border-border'
            }`}
          >
            <div className="flex items-start gap-3">
              {Icon && (
                <Icon
                  className={`mt-0.5 h-7 w-7 shrink-0 ${danger ? 'text-danger' : 'text-warn'}`}
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1 break-words">
                <h2 id={titleId} className="type-title text-ink">
                  {title}
                </h2>
                <p id={descId} className="type-lede mt-2">
                  {body}
                </p>
                {extra ? <div className="mt-4">{extra}</div> : null}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <SecondaryButton size="sm" onClick={handleCancel} className="font-medium text-muted">
                {cancelLabel ?? t('consentCancel')}
              </SecondaryButton>
              {danger ? (
                <motion.button
                  whileTap={reduceMotion || confirming ? undefined : TAP}
                  transition={TAP_TRANSITION}
                  type="button"
                  disabled={confirming}
                  onClick={handleConfirm}
                  className="inline-flex min-h-[44px] cursor-pointer select-none items-center justify-center gap-2 rounded-[var(--radius-ctrl)] border border-danger-border bg-danger-bg px-4 py-2 type-ui font-semibold text-danger-ink transition-colors hover:border-danger hover:bg-danger/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-60"
                >
                  {confirmLabel ?? t('consentAccept')}
                </motion.button>
              ) : (
                <AccentButton size="sm" disabled={confirming} onClick={handleConfirm}>
                  {confirmLabel ?? t('consentAccept')}
                </AccentButton>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}