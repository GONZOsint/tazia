import { useEffect, useRef, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { motion, useAnimate, useReducedMotion } from 'motion/react';
import { DUR, EASE } from '../../motion/tokens';

interface PlaneSendIconProps {
  planeKey: number;
  launching: boolean;
  busy: boolean;
  className?: string;
}

/**
 * Motion-only send: await anticipate → launch → settle, then spinner if still busy.
 * Keep the animated node mounted so useAnimate scope stays valid.
 */
export function PlaneSendIcon({
  planeKey,
  launching: _launching,
  busy,
  className = 'h-4 w-4',
}: PlaneSendIconProps) {
  const [scope, animate] = useAnimate();
  const reduceMotion = useReducedMotion();
  const [animating, setAnimating] = useState(false);
  const lastKeyRef = useRef(0);

  // Sync: mark animating as soon as planeKey advances (before paint commits Loader swap).
  if (planeKey > 0 && planeKey !== lastKeyRef.current) {
    lastKeyRef.current = planeKey;
    if (!animating) setAnimating(true);
  }

  useEffect(() => {
    if (planeKey <= 0) return;
    const el = scope.current;
    if (!el) {
      setAnimating(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        if (reduceMotion) {
          await animate(el, { opacity: [1, 0.5, 1] }, { duration: DUR.micro });
          return;
        }
        await animate(
          el,
          { scale: 0.88, x: -2, y: 2, rotate: -12 },
          { duration: DUR.tap, ease: EASE.easeIn }
        );
        if (cancelled) return;
        await animate(
          el,
          { x: 14, y: -12, scale: 0.75, opacity: 0, rotate: 18 },
          { duration: DUR.tab, ease: EASE.outExpo }
        );
        if (cancelled) return;
        await animate(
          el,
          { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 },
          { ...EASE.planeSpring }
        );
      } finally {
        if (!cancelled) setAnimating(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [planeKey, animate, scope, reduceMotion]);

  const showSpinner = busy && !animating;

  return (
    <span className="relative inline-flex items-center justify-center">
      <motion.span
        ref={scope}
        className="inline-flex"
        style={{ display: showSpinner ? 'none' : 'inline-flex' }}
        aria-hidden={showSpinner}
      >
        <Send className={className} aria-hidden="true" />
      </motion.span>
      {showSpinner && <Loader2 className={`${className} animate-spin`} aria-hidden="true" />}
    </span>
  );
}
