import { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { motion, useAnimate, useReducedMotion } from 'motion/react';
import { DUR, EASE } from '../../motion/tokens';

export interface PlaneSendIconProps {
  planeKey: number;
  launching?: boolean;
  busy: boolean;
  className?: string;
}

const RESET_STATE = { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 };

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
  const [prevPlaneKey, setPrevPlaneKey] = useState(planeKey);
  const [animating, setAnimating] = useState(false);

  // Sync during render so animating=true commits on the same paint before Loader swaps in.
  if (prevPlaneKey !== planeKey) {
    setPrevPlaneKey(planeKey);
    setAnimating(planeKey > 0);
  }

  useEffect(() => {
    const el = scope.current;
    if (!el) return;

    if (planeKey <= 0) {
      animate(el, RESET_STATE, { duration: 0 });
      return;
    }

    let cancelled = false;
    let activeControls: ReturnType<typeof animate> | null = null;

    const run = async () => {
      try {
        // Ensure every launch starts cleanly from rest even if an earlier flight was interrupted.
        animate(el, RESET_STATE, { duration: 0 });

        if (reduceMotion) {
          activeControls = animate(el, { opacity: [1, 0.5, 1] }, { duration: DUR.micro });
          await activeControls;
          return;
        }

        // Light anticipate — avoid stacking a hard squash with the button whileTap.
        activeControls = animate(
          el,
          { scale: 0.94, x: -1, y: 1, rotate: -8 },
          { duration: DUR.tap, ease: EASE.easeIn },
        );
        await activeControls;
        if (cancelled) return;

        activeControls = animate(
          el,
          { x: 12, y: -10, scale: 0.8, opacity: 0, rotate: 14 },
          { duration: DUR.tab, ease: EASE.outExpo },
        );
        await activeControls;
        if (cancelled) return;

        activeControls = animate(el, RESET_STATE, { ...EASE.planeSpring });
        await activeControls;
      } finally {
        if (!cancelled) setAnimating(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      activeControls?.stop();
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
      {showSpinner && (
        <Loader2 className={`${className} motion-safe:animate-spin`} aria-hidden="true" />
      )}
    </span>
  );
}