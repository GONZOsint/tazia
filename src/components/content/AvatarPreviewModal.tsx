import { useEffect, useRef } from 'react';
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

/** Large light-plate preview of a peer flame — same ritual motion as other sheets. */
export function AvatarPreviewModal({ open, seed, alias, onClose }: AvatarPreviewModalProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const sheet = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={modalScrim.initial}
          animate={modalScrim.animate}
          exit={modalScrim.exit}
          transition={modalScrim.transition}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim-strong p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('avatarPreviewTitle', { alias })}
          onClick={onClose}
        >
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : modalSheet.initial}
            animate={reduceMotion ? { opacity: 1 } : modalSheet.animate}
            exit={reduceMotion ? { opacity: 0 } : modalSheet.exit}
            transition={modalSheet.transition}
            className="panel-surface shadow-sheet relative w-full max-w-[280px] overflow-hidden outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="type-caption text-muted">{t('avatarPreviewEyebrow')}</p>
                <h2 className="type-title truncate text-ink">{alias}</h2>
              </div>
              <motion.button
                ref={closeRef}
                whileTap={TAP}
                transition={TAP_TRANSITION}
                type="button"
                onClick={onClose}
                className="icon-action shrink-0 text-ink focus-visible:outline-2 focus-visible:outline-accent"
                aria-label={t('avatarPreviewClose')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </motion.button>
            </div>

            <div className="flex flex-col items-center gap-3 px-5 py-6">
              <motion.div
                initial={reduceMotion ? false : peerMaterialize.initial}
                animate={peerMaterialize.animate}
                className="flame-avatar-plate"
              >
                <FlameAvatar seed={seed} size={168} label={alias} animated />
              </motion.div>
              <p className="type-caption text-center text-muted">{t('avatarPreviewHint')}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(sheet, document.body);
}
