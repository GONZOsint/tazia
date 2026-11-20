import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion, stagger, useAnimate, useReducedMotion } from 'motion/react';
import { deriveEmojiSafetyCode } from '../../core/trust/trustStore';
import { useT } from '../../i18n';
import { ConfettiBurst } from '../ui/ConfettiBurst';
import {
  CONFETTI,
  DUR,
  EASE,
  TAP,
  TAP_TRANSITION,
  VERIFY,
  modalScrim,
  modalSheet,
} from '../../motion/tokens';
import { haptic, HAPTIC_RITUAL } from '../../motion/haptic';

interface EmojiVerifyModalProps {
  open: boolean;
  peerAlias: string;
  selfKeyB64: string;
  peerKeyB64: string;
  selfEncB64?: string;
  peerEncB64?: string;
  roomId?: string;
  /** Apply trust commit; return false to abort celebration (e.g. key drift). */
  onVerify: () => boolean;
  onClose: () => void;
}

const TINTS = ['accent', 'ok', 'warn', 'info', 'accent', 'ok'] as const;

/** Slightly different rest pose per tile so each reads as its own 3D chip. */
const CELL_REST = [
  { rotX: 8, rotY: -6 },
  { rotX: 5, rotY: 4 },
  { rotX: 9, rotY: -2 },
  { rotX: 6, rotY: 7 },
  { rotX: 7, rotY: -5 },
  { rotX: 4, rotY: 3 },
] as const;

const TILT_RANGE = 11;
const FOLLOW = 0.16;

type CellPose = { rotX: number; rotY: number; z: number };

function writeCellPose(el: HTMLElement, p: CellPose) {
  el.style.transform = `rotateX(${p.rotX.toFixed(2)}deg) rotateY(${p.rotY.toFixed(2)}deg) translateZ(${p.z.toFixed(1)}px)`;
}

export function EmojiVerifyModal({
  open,
  peerAlias,
  selfKeyB64,
  peerKeyB64,
  selfEncB64 = '',
  peerEncB64 = '',
  roomId = '',
  onVerify,
  onClose,
}: EmojiVerifyModalProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [handshakeDone, setHandshakeDone] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [emojiScope, animate] = useAnimate();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    if (!selfKeyB64 || !peerKeyB64) {
      setCode(null);
      return;
    }
    let cancelled = false;
    void deriveEmojiSafetyCode(selfKeyB64, peerKeyB64, roomId, selfEncB64, peerEncB64).then(
      (c) => {
        if (!cancelled) setCode(c);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [open, selfKeyB64, peerKeyB64, selfEncB64, peerEncB64, roomId]);

  // Key snapshot refreshed while open — drop success chrome so user re-confirms new SAS.
  // Skip while committing/celebrating (trust apply may clear currentKey → parent refreshes props).
  useEffect(() => {
    if (!open || verifying || handshakeDone) return;
    setVerifying(false);
    setHandshakeDone(false);
    setConfetti(false);
  }, [open, peerKeyB64, peerEncB64, verifying, handshakeDone]);

  useEffect(() => {
    if (!open) {
      setVerifying(false);
      setHandshakeDone(false);
      setConfetti(false);
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

  // Per-emoji 3D tilt — each cell tracks the pointer independently.
  useEffect(() => {
    if (!open || !code || reduceMotion || verifying || handshakeDone) return;
    const root = emojiScope.current;
    if (!root) return;
    const cellNodes = Array.from(
      (root as HTMLElement).querySelectorAll('[data-emoji-cell]')
    ) as HTMLElement[];

    if (window.matchMedia('(hover: none)').matches) {
      // Still apply distinct rest poses on touch devices.
      cellNodes.forEach((el, i) => {
        const rest = CELL_REST[i] ?? CELL_REST[0]!;
        writeCellPose(el, { ...rest, z: 0 });
      });
      return;
    }

    type Track = {
      el: HTMLElement;
      current: CellPose;
      target: CellPose;
      rest: { rotX: number; rotY: number };
      raf: number;
      lastTs: number;
    };

    const tracks: Track[] = cellNodes.map((el, i) => {
      const rest = CELL_REST[i] ?? CELL_REST[0]!;
      const pose = { rotX: rest.rotX, rotY: rest.rotY, z: 0 };
      el.style.transition = 'none';
      writeCellPose(el, pose);
      return {
        el,
        current: { ...pose },
        target: { ...pose },
        rest: { rotX: rest.rotX, rotY: rest.rotY },
        raf: 0,
        lastTs: performance.now(),
      };
    });

    const tick = (track: Track, ts: number) => {
      const dt = Math.min(32, ts - track.lastTs);
      track.lastTs = ts;
      const k = 1 - Math.pow(1 - FOLLOW, dt / 16.67);
      track.current.rotX += (track.target.rotX - track.current.rotX) * k;
      track.current.rotY += (track.target.rotY - track.current.rotY) * k;
      track.current.z += (track.target.z - track.current.z) * k;
      writeCellPose(track.el, track.current);
      const settled =
        Math.abs(track.current.rotX - track.target.rotX) < 0.04 &&
        Math.abs(track.current.rotY - track.target.rotY) < 0.04 &&
        Math.abs(track.current.z - track.target.z) < 0.06;
      if (!settled) track.raf = requestAnimationFrame((t) => tick(track, t));
      else track.raf = 0;
    };

    const kick = (track: Track) => {
      if (track.raf) return;
      track.lastTs = performance.now();
      track.raf = requestAnimationFrame((t) => tick(track, t));
    };

    const cleanups = tracks.map((track) => {
      const onMove = (e: PointerEvent) => {
        const r = track.el.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
        const cx = Math.max(-1, Math.min(1, nx));
        const cy = Math.max(-1, Math.min(1, ny));
        track.target = {
          rotX: track.rest.rotX - cy * TILT_RANGE,
          rotY: track.rest.rotY + cx * TILT_RANGE,
          z: 10,
        };
        kick(track);
      };
      const onLeave = () => {
        track.target = { rotX: track.rest.rotX, rotY: track.rest.rotY, z: 0 };
        kick(track);
      };
      track.el.addEventListener('pointermove', onMove, { passive: true });
      track.el.addEventListener('pointerleave', onLeave);
      return () => {
        if (track.raf) cancelAnimationFrame(track.raf);
        track.el.removeEventListener('pointermove', onMove);
        track.el.removeEventListener('pointerleave', onLeave);
        track.el.style.transition = '';
        track.el.style.transform = '';
      };
    });

    return () => {
      for (const c of cleanups) c();
    };
  }, [open, code, reduceMotion, verifying, handshakeDone, emojiScope]);

  const glyphs = code ? Array.from(code) : [];

  const handleMatch = async () => {
    if (verifying) return;
    setVerifying(true);
    // Commit trust before celebration — never show success for a failed/noop apply.
    const ok = onVerify();
    if (!ok) {
      setVerifying(false);
      return;
    }
    if (!reduceMotion) {
      haptic(HAPTIC_RITUAL);
    }
    if (emojiScope.current) {
      if (reduceMotion) {
        await animate('[data-emoji-cell]', { opacity: [1, 0.4, 0] }, { duration: DUR.micro });
      } else {
        // Sweep: each emoji pulses in sequence, then collapses toward center.
        await animate(
          '[data-emoji-cell]',
          {
            scale: [1, 1.1, 1],
            y: [0, -4, 0],
          },
          {
            duration: VERIFY.pulseDur,
            delay: stagger(VERIFY.pulseStagger),
            ease: EASE.outExpo,
          }
        );
        await animate(
          '[data-emoji-cell]',
          {
            opacity: 0,
            scale: 0.28,
            y: 12,
          },
          {
            duration: VERIFY.collapseDur,
            delay: stagger(VERIFY.collapseStagger),
            ease: EASE.easeIn,
          }
        );
      }
    }
    setHandshakeDone(true);
    setConfetti(true);
    await new Promise((r) =>
      window.setTimeout(
        r,
        reduceMotion
          ? VERIFY.reducedHoldMs
          : Math.max(VERIFY.tickHoldMs, CONFETTI.ms * 0.85)
      )
    );
    onClose();
  };

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
          aria-label={t('trustVerifyTitle')}
          onClick={verifying ? undefined : onClose}
        >
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={modalSheet.initial}
            animate={modalSheet.animate}
            exit={modalSheet.exit}
            transition={modalSheet.transition}
            className="panel-surface shadow-sheet relative w-full max-w-xs overflow-hidden outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <ConfettiBurst play={confetti} onDone={() => setConfetti(false)} origin={{ x: 50, y: 42 }} />
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="type-ui flex items-center gap-2 font-semibold text-ink">
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
                <div className="verify-emoji-stage relative mx-auto mt-4 max-w-[14rem]">
                  <div
                    ref={emojiScope}
                    className={`verify-emoji-grid grid grid-cols-3 gap-2.5 ${handshakeDone ? 'pointer-events-none' : ''}`}
                    role="img"
                    aria-label={t('trustEmojiLabel')}
                    style={{ opacity: handshakeDone ? 0 : 1 }}
                  >
                    {glyphs.map((glyph, i) => (
                      <motion.span
                        key={`${glyph}-${i}`}
                        data-emoji-cell
                        data-tint={TINTS[i]!}
                        initial={
                          reduceMotion
                            ? false
                            : { opacity: 0, scale: 0.78, rotateX: 52, z: -28 }
                        }
                        animate={{ opacity: 1, scale: 1, rotateX: 0, z: 0 }}
                        transition={{
                          delay: reduceMotion ? 0 : 0.06 + i * VERIFY.enterStagger,
                          duration: VERIFY.enterDur,
                          ease: EASE.outExpo,
                        }}
                        className="verify-emoji-cell"
                        style={{ transformStyle: 'preserve-3d' }}
                      >
                        <span className="verify-emoji-glyph" aria-hidden="true">
                          {glyph}
                        </span>
                      </motion.span>
                    ))}
                  </div>
                  <AnimatePresence>
                    {handshakeDone && (
                      <motion.div
                        className="absolute inset-0 flex items-center justify-center"
                        initial={{ opacity: 0, scale: 0.45 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={
                          reduceMotion
                            ? { duration: DUR.micro }
                            : VERIFY.tickSpring
                        }
                      >
                        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_0_24px_color-mix(in_oklab,var(--color-accent)_45%,transparent)]">
                          <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden="true" />
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                  className="flex-1 min-h-[44px] rounded-[var(--radius-ctrl)] border border-border px-3 py-2 type-ui font-semibold text-muted hover:bg-bg focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                >
                  {t('trustNoMatch')}
                </motion.button>
                <motion.button
                  whileTap={verifying ? undefined : TAP}
                  transition={TAP_TRANSITION}
                  type="button"
                  onClick={() => void handleMatch()}
                  disabled={verifying || !code}
                  className="btn-accent-sheen flex-1 min-h-[44px] rounded-[var(--radius-ctrl)] bg-accent px-3 py-2 type-ui font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
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

  if (typeof document === 'undefined') return null;
  return createPortal(sheet, document.body);
}
