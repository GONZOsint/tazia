import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CONFETTI } from '../../motion/tokens';

interface ConfettiBurstProps {
  play: boolean;
  onDone?: () => void;
  /** Origin as % of parent (default center). */
  origin?: { x: number; y: number };
}

const COLORS = [
  'var(--color-accent)',
  'var(--fire-core)',
  'var(--fire-mid)',
  'var(--color-ok)',
  'color-mix(in oklab, var(--color-ink) 35%, transparent)',
];

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
        const angle = (Math.PI * 2 * i) / CONFETTI.count + (i % 3) * 0.2;
        const dist = 36 + (i % 5) * 14;
        return {
          id: i,
          color: COLORS[i % COLORS.length]!,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 12,
          rot: (i % 2 === 0 ? 1 : -1) * (40 + (i % 7) * 18),
          w: 4 + (i % 3),
          h: 6 + (i % 4),
        };
      }),
    []
  );

  useEffect(() => {
    if (!play) return;
    const id = window.setTimeout(() => onDone?.(), CONFETTI.ms);
    return () => window.clearTimeout(id);
  }, [play, onDone]);

  return (
    <AnimatePresence>
      {play && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-40 overflow-hidden"
          aria-hidden="true"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {pieces.map((p) => (
            <motion.span
              key={p.id}
              className="absolute rounded-[1px]"
              style={{
                left: `${origin.x}%`,
                top: `${origin.y}%`,
                width: p.w,
                height: p.h,
                background: p.color,
                marginLeft: -p.w / 2,
                marginTop: -p.h / 2,
              }}
              initial={{ opacity: 1, x: 0, y: 0, scale: 0.6, rotate: 0 }}
              animate={
                reduceMotion
                  ? { opacity: [1, 0], scale: [0.8, 1] }
                  : {
                      opacity: [1, 1, 0],
                      x: p.x,
                      y: p.y,
                      scale: [0.6, 1.05, 0.85],
                      rotate: p.rot,
                    }
              }
              transition={{
                duration: CONFETTI.ms / 1000,
                ease: [0.16, 1, 0.3, 1],
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
