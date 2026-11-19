import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CONFETTI, DUR, EASE } from '../../motion/tokens';

interface ConfettiBurstProps {
  play: boolean;
  onDone?: () => void;
  /** Origin as % of parent (default center). */
  origin?: { x: number; y: number };
}

type PieceShape = 'strip' | 'square' | 'chip';

const COLORS = [
  'var(--color-accent)',
  'var(--fire-core)',
  'var(--fire-mid)',
  'var(--color-ok)',
  'color-mix(in oklab, var(--color-ink) 40%, transparent)',
  'color-mix(in oklab, var(--color-accent) 70%, white)',
] as const;

/** Deterministic 0–1 from index — stable across mounts, looks organic. */
function hash(i: number, salt = 0): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function shapeFor(i: number): PieceShape {
  const r = hash(i, 1);
  if (r < 0.45) return 'strip';
  if (r < 0.78) return 'chip';
  return 'square';
}

/**
 * Lightweight lime/ash confetti — ritual only (create zone, verify OK).
 * Max CONFETTI.ms; opacity/color only under reduced motion.
 */
export function ConfettiBurst({
  play,
  onDone,
  origin = { x: 50, y: 45 },
}: ConfettiBurstProps) {
  const reduceMotion = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI.count }, (_, i) => {
        const shape = shapeFor(i);
        const angle =
          (Math.PI * 2 * i) / CONFETTI.count +
          (hash(i, 2) - 0.5) * 0.55;
        const dist = 42 + hash(i, 3) * 52 + (i % 4) * 6;
        const drift = (hash(i, 4) - 0.5) * 18;
        const fall = 18 + hash(i, 5) * 28;
        const spin = (hash(i, 6) > 0.5 ? 1 : -1) * (90 + hash(i, 7) * 220);
        const delay = hash(i, 8) * 0.055;

        let w: number;
        let h: number;
        if (shape === 'strip') {
          w = 3 + hash(i, 9) * 2;
          h = 8 + hash(i, 10) * 7;
        } else if (shape === 'chip') {
          w = 5 + hash(i, 9) * 3;
          h = 4 + hash(i, 10) * 3;
        } else {
          const s = 3.5 + hash(i, 9) * 2.5;
          w = s;
          h = s;
        }

        return {
          id: i,
          shape,
          color: COLORS[i % COLORS.length]!,
          x: Math.cos(angle) * dist + drift,
          y: Math.sin(angle) * dist * 0.85 - 8 + fall,
          midX: Math.cos(angle) * dist * 0.55 + drift * 0.4,
          midY: Math.sin(angle) * dist * 0.45 - 22,
          rot: spin,
          w,
          h,
          delay,
          radius: shape === 'square' ? 1 : shape === 'chip' ? 1.5 : 0.5,
        };
      }),
    []
  );

  useEffect(() => {
    if (!play) return;
    const id = window.setTimeout(() => onDone?.(), CONFETTI.ms);
    return () => window.clearTimeout(id);
  }, [play, onDone]);

  const dur = CONFETTI.ms / 1000;

  return (
    <AnimatePresence>
      {play && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
          aria-hidden="true"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: DUR.micro } }}
        >
          {/* Origin flash — reads as the spark that launches the burst */}
          <motion.span
            className="absolute rounded-full"
            style={{
              left: `${origin.x}%`,
              top: `${origin.y}%`,
              width: 10,
              height: 10,
              marginLeft: -5,
              marginTop: -5,
              background:
                'radial-gradient(circle, color-mix(in oklab, var(--color-accent) 90%, white) 0%, transparent 70%)',
              boxShadow:
                '0 0 18px 4px color-mix(in oklab, var(--color-accent) 45%, transparent)',
            }}
            initial={{ opacity: 0.95, scale: 0.35 }}
            animate={
              reduceMotion
                ? { opacity: [0.9, 0], scale: [0.6, 1.2] }
                : { opacity: [0.95, 0.55, 0], scale: [0.35, 1.65, 2.4] }
            }
            transition={{ duration: dur * 0.55, ease: EASE.outExpo }}
          />

          {pieces.map((p) => (
            <motion.span
              key={p.id}
              className="absolute"
              style={{
                left: `${origin.x}%`,
                top: `${origin.y}%`,
                width: p.w,
                height: p.h,
                background: p.color,
                borderRadius: p.radius,
                marginLeft: -p.w / 2,
                marginTop: -p.h / 2,
                boxShadow:
                  p.shape === 'strip'
                    ? undefined
                    : '0 0 6px color-mix(in oklab, var(--color-accent) 22%, transparent)',
              }}
              initial={{
                opacity: 0,
                x: 0,
                y: 0,
                scale: 0.35,
                rotate: 0,
              }}
              animate={
                reduceMotion
                  ? { opacity: [0.9, 0], scale: [0.7, 1.05] }
                  : {
                      opacity: [0, 1, 1, 0],
                      x: [0, p.midX, p.x],
                      y: [0, p.midY, p.y],
                      scale: [0.35, 1.12, 0.78],
                      rotate: [0, p.rot * 0.45, p.rot],
                    }
              }
              transition={
                reduceMotion
                  ? { duration: dur * 0.6, ease: 'easeOut' }
                  : {
                      duration: dur,
                      delay: p.delay,
                      ease: [0.14, 0.85, 0.22, 1],
                      opacity: {
                        duration: dur,
                        delay: p.delay,
                        times: [0, 0.08, 0.62, 1],
                        ease: 'linear',
                      },
                    }
              }
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
