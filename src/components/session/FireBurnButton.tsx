import { useEffect, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { motion } from 'motion/react';
import {
  FIRE_BTN_CIRCLE,
  FIRE_BTN_PILL,
  mountFireButton,
  type FireButtonHandle,
} from '../../motion/fireButton';
import { TAP, TAP_TRANSITION } from '../../motion/tokens';

export type FireBurnMode = 'ignite' | 'extinguish';

interface FireBurnButtonProps {
  label: string;
  onClick: () => void;
  /**
   * ignite — starts unlit; click lights WebGL then calls onClick (enter app).
   * extinguish — auto-lit; click confirms session burn (default).
   */
  mode?: FireBurnMode;
  /** Session extinguish choreography — visually put the flame out. */
  dying?: boolean;
  disabled?: boolean;
  /** Force pill layout (landing). Default follows sm breakpoint. */
  forcePill?: boolean;
  /** Skip header clearance class (landing is not in TopBar). */
  className?: string;
}

function useIsPill(forcePill?: boolean): boolean {
  const [pill, setPill] = useState(() =>
    forcePill ||
    (typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : false)
  );
  useEffect(() => {
    if (forcePill) {
      setPill(true);
      return;
    }
    const mq = window.matchMedia('(min-width: 640px)');
    const onChange = () => setPill(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [forcePill]);
  return pill;
}

/**
 * Accent fire button with WebGL crown.
 * App entry (ignite) or session extinguish (extinguish) — same control, mirrored ritual.
 */
export function FireBurnButton({
  label,
  onClick,
  mode = 'extinguish',
  dying = false,
  disabled = false,
  forcePill = false,
  className = '',
}: FireBurnButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<FireButtonHandle | null>(null);
  const isPill = useIsPill(forcePill);
  const isIgnite = mode === 'ignite';

  useEffect(() => {
    const btn = btnRef.current;
    const canvas = canvasRef.current;
    if (!btn || !canvas) return;

    const handle = mountFireButton(btn, canvas, isPill ? FIRE_BTN_PILL : FIRE_BTN_CIRCLE);
    handleRef.current = handle;
    if (!handle) return;

    if (!isIgnite) {
      const t = window.setTimeout(() => {
        if (!dying) handle.setLit(true, 0.5);
      }, isPill ? 320 : 180);
      return () => {
        window.clearTimeout(t);
        handle.destroy();
        handleRef.current = null;
      };
    }

    handle.setLit(false, 0.5);
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
  }, [isPill, isIgnite]);

  useEffect(() => {
    if (isIgnite) return;
    handleRef.current?.setLit(!dying, 0.5);
  }, [dying, isIgnite]);

  const handleClick = () => {
    if (disabled || dying) return;
    if (isIgnite) {
      const rect = btnRef.current?.getBoundingClientRect();
      const originX = rect && rect.width > 0 ? 0.5 : 0.5;
      handleRef.current?.setLit(true, originX);
      // Brief beat so the crown ignites before the shell swaps.
      window.setTimeout(() => onClick(), 280);
      return;
    }
    onClick();
  };

  const headerClass = forcePill || isIgnite ? '' : 'fire-btn--header';

  return (
    <motion.button
      ref={btnRef}
      whileTap={dying || disabled ? undefined : TAP}
      transition={TAP_TRANSITION}
      type="button"
      onClick={handleClick}
      disabled={disabled || dying}
      aria-label={label}
      title={label}
      aria-pressed={isIgnite ? false : !dying}
      className={`fire-btn burn-heat session-burn-target ${headerClass} ${
        isPill ? 'fire-btn--pill' : 'fire-btn--circle'
      } ${dying ? 'is-dying' : ''} ${className}`.trim()}
    >
      <canvas ref={canvasRef} className="fire-canvas" aria-hidden="true" />
      {dying ? (
        <span className="fire-btn__icon relative z-10 inline-flex h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <span className="fire-btn__icon burn-flame-icon relative z-10 inline-flex h-4 w-4 shrink-0">
          <Flame className="h-4 w-4" aria-hidden="true" strokeWidth={1.9} />
        </span>
      )}
      {isPill && <span className="fire-btn__label relative z-10 truncate">{label}</span>}
    </motion.button>
  );
}
