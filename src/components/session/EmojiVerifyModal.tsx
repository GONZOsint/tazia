import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion, stagger, useAnimate, useReducedMotion } from 'motion/react';
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

const TINTS = ['accent', 'ok', 'warn', 'info', 'accent', 'ok'] as const;

const GRID_REST = { rotX: 7, rotY: -5, z: 0 } as const;
const TILT_RANGE = 7;
const FOLLOW = 0.14;

type GridPose = { rotX: number; rotY: number; z: number };

function writeGridPose(el: HTMLElement, p: GridPose) {
  el.style.transform = `rotateX(${p.rotX.toFixed(2)}deg) rotateY(${p.rotY.toFixed(2)}deg) translateZ(${p.z.toFixed(1)}px)`;
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
      setCode(null);
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

  // Soft 3D tilt on the emoji stage — palette chrome stays CSS; JS only owns transform.
  useEffect(() => {
    if (!open || !code || reduceMotion) return;
    const el = emojiScope.current;
    if (!el) return;
    if (window.matchMedia('(hover: none)').matches) return;

    let raf = 0;
    let running = true;
    const current: GridPose = { ...GRID_REST };
    let target: GridPose = { ...GRID_REST };
    let lastTs = performance.now();

    el.style.transition = 'none';
    writeGridPose(el, current);

    const tick = (ts: number) => {
      if (!running) return;
      const dt = Math.min(32, ts - lastTs);
      lastTs = ts;
      const k = 1 - Math.pow(1 - FOLLOW, dt / 16.67);
      current.rotX += (target.rotX - current.rotX) * k;
      current.rotY += (target.rotY - current.rotY) * k;
      current.z += (target.z - current.z) * k;
      writeGridPose(el, current);
      const settled =
        Math.abs(current.rotX - target.rotX) < 0.03 &&
        Math.abs(current.rotY - target.rotY) < 0.03 &&
        Math.abs(current.z - target.z) < 0.05;
      if (!settled) raf = requestAnimationFrame(tick);
      else raf = 0;
    };

    const kick = () => {
      if (raf) return;
      lastTs = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
      const cx = Math.max(-1, Math.min(1, nx));
      const cy = Math.max(-1, Math.min(1, ny));
      target = {
        rotX: GRID_REST.rotX - cy * TILT_RANGE,
        rotY: GRID_REST.rotY + cx * TILT_RANGE,
        z: 4,
      };
      kick();
    };

    const onLeave = () => {
      target = { ...GRID_REST };
      kick();
    };

    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);
    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.style.transition = '';
      el.style.transform = '';
    };
  }, [open, code, reduceMotion, emojiScope]);

  const glyphs = code ? Array.from(code) : [];

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
        '[data-emoji-cell]',
        reduceMotion
          ? { opacity: [1, 0.55, 1] }
          : {
              opacity: [1, 1, 1],
              scale: [1, 1.1, 1],
              y: [0, -3, 0],
              rotateX: [0, -8, 0],
              boxShadow: [
                '0 8px 16px color-mix(in oklab, #000 16%, transparent)',
                '0 0 0 1px color-mix(in oklab, var(--color-accent) 55%, transparent), 0 12px 22px color-mix(in oklab, var(--color-accent) 28%, transparent)',
                '0 8px 16px color-mix(in oklab, #000 16%, transparent)',
              ],
            },
        { duration: 0.26, delay: stagger(0.04), ease: EASE.outExpo }
      );
    } else {
      await new Promise((r) => window.setTimeout(r, 260));
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
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
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
                <div className="verify-emoji-stage mx-auto mt-4 max-w-[14rem]">
                  <div
                    ref={emojiScope}
                    className="verify-emoji-grid grid grid-cols-3 gap-2"
                    role="img"
                    aria-label={t('trustEmojiLabel')}
                  >
                    {glyphs.map((glyph, i) => (
                      <motion.span
                        key={`${glyph}-${i}`}
                        data-emoji-cell
                        data-tint={TINTS[i]!}
                        initial={
                          reduceMotion
                            ? false
                            : { opacity: 0, scale: 0.82, rotateX: 48, z: -24 }
                        }
                        animate={{ opacity: 1, scale: 1, rotateX: 0, z: 0 }}
                        transition={{
                          delay: reduceMotion ? 0 : 0.04 + i * 0.045,
                          duration: DUR.switch,
                          ease: EASE.outExpo,
                        }}
                        className={`verify-emoji-cell ${verifying ? '' : 'is-idle'}`}
                        style={{ transformStyle: 'preserve-3d' }}
                      >
                        <span className="verify-emoji-glyph" aria-hidden="true">
                          {glyph}
                        </span>
                      </motion.span>
                    ))}
                  </div>
                </div>
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
