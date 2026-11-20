import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useT } from '../../i18n';
import { TAP, TAP_TRANSITION, modalScrim, modalSheet, peerMaterialize } from '../../motion/tokens';
import { FlameAvatar } from './FlameAvatar';

interface AvatarPreviewModalProps {
  open: boolean;
  seed: string;
  alias: string;
  onClose: () => void;
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

/** Large light-plate preview of a peer flame — same ritual motion as other sheets. */
export function AvatarPreviewModal({ open, seed, alias, onClose }: AvatarPreviewModalProps) {
  const t = useT();
  const isClient = useIsClient();
  const reduceMotion = useReducedMotion();
  const hintId = useId();

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pointerDownOnScrim = useRef(false);

  const isOpenRef = useRef(open);
  isOpenRef.current = open;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !isClient) return;

    const previousActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    (closeRef.current ?? dialogRef.current)?.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
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
      onCloseRef.current();
    }
  };

  const handleClose = () => {
    if (!isOpenRef.current) return;
    onCloseRef.current();
  };

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="avatar-preview-modal"
          initial={modalScrim.initial}
          animate={modalScrim.animate}
          exit={modalScrim.exit}
          transition={modalScrim.transition}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim-strong p-4"
          onPointerDown={handleScrimPointerDown}
          onClick={handleScrimClick}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('avatarPreviewTitle', { alias })}
            aria-describedby={hintId}
            tabIndex={-1}
            initial={reduceMotion ? { opacity: 0 } : modalSheet.initial}
            animate={reduceMotion ? { opacity: 1 } : modalSheet.animate}
            exit={reduceMotion ? { opacity: 0 } : modalSheet.exit}
            transition={reduceMotion ? { duration: 0.12 } : modalSheet.transition}
            className="panel-surface shadow-sheet relative w-full max-w-[280px] overflow-hidden outline-none"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="type-caption text-muted">{t('avatarPreviewEyebrow')}</p>
                <h2 className="type-title truncate text-ink" title={alias}>
                  {alias}
                </h2>
              </div>
              <motion.button
                ref={closeRef}
                whileTap={reduceMotion ? undefined : TAP}
                transition={TAP_TRANSITION}
                type="button"
                onClick={handleClose}
                className="icon-action shrink-0 cursor-pointer select-none text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                aria-label={t('avatarPreviewClose')}
                title={t('avatarPreviewClose')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </motion.button>
            </div>

            <div className="flex flex-col items-center gap-3 px-5 py-6">
              <motion.div
                initial={reduceMotion ? false : peerMaterialize.initial}
                animate={peerMaterialize.animate}
                transition={reduceMotion ? { duration: 0 } : undefined}
                className="flame-avatar-plate"
              >
                <FlameAvatar seed={seed} size={168} label={alias} animated={!reduceMotion} />
              </motion.div>
              <p id={hintId} className="type-caption text-center text-muted text-balance break-words">
                {t('avatarPreviewHint')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}