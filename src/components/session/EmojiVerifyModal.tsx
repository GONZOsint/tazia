import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react';
import { deriveEmojiSafetyCode } from '../../core/trust/trustStore';
import { useT } from '../../i18n';
import { DUR, EASE, TAP, TAP_TRANSITION } from '../../motion/tokens';

interface EmojiVerifyModalProps {
  open: boolean;
  peerAlias: string;
  selfKeyB64: string;
  peerKeyB64: string;
  roomId?: string;
  onVerify: () => void;
  onClose: () => void;
}

export function EmojiVerifyModal({
  open,
  peerAlias,
  selfKeyB64,
  peerKeyB64,
  roomId = '',
  onVerify,
  onClose,
}: EmojiVerifyModalProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [emojiScope, animate] = useAnimate();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open || !selfKeyB64 || !peerKeyB64) return;
    let cancelled = false;
    void deriveEmojiSafetyCode(selfKeyB64, peerKeyB64, roomId).then((c) => {
      if (!cancelled) setCode(c);
    });
    return () => {
      cancelled = true;
    };
  }, [open, selfKeyB64, peerKeyB64, roomId]);

  useEffect(() => {
    if (!open) {
      setVerifying(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !verifying) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, verifying]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  const handleMatch = async () => {
    if (verifying) return;
    setVerifying(true);
    if (!reduceMotion) {
      try {
        navigator.vibrate?.(10);
      } catch {
        /* ignore */
      }
    }
    if (emojiScope.current) {
      await animate(
        emojiScope.current,
        reduceMotion
          ? { opacity: [1, 0.55, 1], color: 'var(--color-accent)' }
          : { opacity: [1, 0.7, 1], scale: [1, 1.06, 1], color: 'var(--color-accent)' },
        { duration: 0.26, ease: EASE.outExpo }
      );
    } else {
      await new Promise((r) => window.setTimeout(r, 220));
    }
    onVerify();
  };

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
          aria-label={t('trustVerifyTitle')}
          onClick={verifying ? undefined : onClose}
        >
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: DUR.modal, ease: EASE.outExpo }}
            className="panel-surface shadow-sheet relative w-full max-w-xs overflow-hidden outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ShieldCheck className="h-4 w-4 text-ok" aria-hidden="true" />
                {t('trustVerifyTitle')}
              </div>
              <motion.button
                whileTap={TAP}
                transition={TAP_TRANSITION}
                type="button"
                onClick={onClose}
                disabled={verifying}
                className="icon-action icon-action--ghost focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                aria-label={t('consentCancel')}
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>

            <div className="p-5 text-center">
              <p className="text-xs text-muted">{t('trustVerifyHint')}</p>
              <p className="mt-1 text-xs font-semibold text-ink">{peerAlias}</p>

              {code ? (
                <p
                  ref={emojiScope}
                  className="mx-auto mt-4 text-4xl tracking-widest"
                  role="img"
                  aria-label={t('trustEmojiLabel')}
                >
                  {code}
                </p>
              ) : (
                <p className="mt-4 text-sm text-muted">…</p>
              )}

              <div className="mt-6 flex gap-3">
                <motion.button
                  whileTap={TAP}
                  transition={TAP_TRANSITION}
                  type="button"
                  onClick={onClose}
                  disabled={verifying}
                  className="flex-1 min-h-[44px] rounded-[var(--radius-ctrl)] border border-border px-3 py-2 text-xs font-semibold text-muted hover:bg-bg focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                >
                  {t('trustNoMatch')}
                </motion.button>
                <motion.button
                  whileTap={verifying ? undefined : TAP}
                  transition={TAP_TRANSITION}
                  type="button"
                  onClick={() => void handleMatch()}
                  disabled={verifying || !code}
                  className="btn-accent-sheen flex-1 min-h-[44px] rounded-[var(--radius-ctrl)] bg-accent px-3 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                >
                  {t('trustMatch')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
