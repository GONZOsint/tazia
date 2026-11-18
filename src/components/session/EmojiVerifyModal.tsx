import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { motion } from 'motion/react';
import { deriveEmojiSafetyCode } from '../../core/trust/trustStore';
import { useT } from '../../i18n';

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

  useEffect(() => {
    if (!open || !selfKeyB64 || !peerKeyB64) return;
    let cancelled = false;
    void deriveEmojiSafetyCode(selfKeyB64, peerKeyB64, roomId).then((c) => {
      if (!cancelled) setCode(c);
    });
    return () => { cancelled = true; };
  }, [open, selfKeyB64, peerKeyB64, roomId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('trustVerifyTitle')}
      ref={dialogRef}
      tabIndex={-1}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-surface-raised"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ShieldCheck className="h-4 w-4 text-ok" aria-hidden="true" />
            {t('trustVerifyTitle')}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 text-center">
          <p className="text-xs text-muted">{t('trustVerifyHint')}</p>
          <p className="mt-1 text-xs font-semibold text-ink">{peerAlias}</p>

          {code ? (
            <p
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
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted focus-visible:outline-2 focus-visible:outline-accent"
            >
              {t('trustNoMatch')}
            </button>
            <button
              type="button"
              onClick={onVerify}
              className="flex-1 min-h-[44px] rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent"
            >
              {t('trustMatch')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
