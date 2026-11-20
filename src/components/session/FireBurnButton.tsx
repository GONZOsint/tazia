import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Flame } from 'lucide-react';
import { motion } from 'motion/react';
import {
  FIRE_BTN_CIRCLE,
  FIRE_BTN_PILL,
  mountFireButton,
  type FireButtonHandle,
  type FireButtonMountOptions,
} from '../../motion/fireButton';
import { FIRE_EXTINGUISH_SPRING, FIRE_IGNITE_SPRING } from '../../motion/fireButton/exactSpring';
import { TAP, TAP_TRANSITION } from '../../motion/tokens';

export type FireBurnMode = 'ignite' | 'extinguish';

interface FireBurnButtonProps {
  label: string;
  /**
   * ignite — lights crown then calls onClick(originX); parent owns session timing.
   * extinguish — auto-lit; click confirms session burn.
   */
  onClick: (originX?: number) => void;
  mode?: FireBurnMode;
  /** Session extinguish choreography — visually put the flame out. */
  dying?: boolean;
  disabled?: boolean;
  /** Force pill layout (landing). Default follows sm breakpoint. */
  forcePill?: boolean;
  /** Force round icon-only control (TopBar extinguish). Wins over forcePill. */
  forceCircle?: boolean;
  className?: string;
  /** When false, pointer wind/proximity paused (e.g. mid-intro burn). */
  pointerActive?: boolean;
}

function useIsPill(forcePill?: boolean, forceCircle?: boolean): boolean {
  const [pill, setPill] = useState(() => {
    if (forceCircle) return false;
    return (
      forcePill ||
      (typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : false)
    );
  });
  useEffect(() => {
    if (forceCircle) {
      setPill(false);
      return;
    }
    if (forcePill) {
      setPill(true);
      return;
    }
    const mq = window.matchMedia('(min-width: 640px)');
    const onChange = () => setPill(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [forcePill, forceCircle]);
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
  forceCircle = false,
  className = '',
  pointerActive = true,
}: FireBurnButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<FireButtonHandle | null>(null);
  const pointerActiveRef = useRef(pointerActive);
  pointerActiveRef.current = pointerActive;
  const isPill = useIsPill(forcePill, forceCircle);
  const isIgnite = mode === 'ignite';

  useEffect(() => {
    const btn = btnRef.current;
    const canvas = canvasRef.current;
    if (!btn || !canvas) return;

    const opts: FireButtonMountOptions = {
      igniteParams: isIgnite ? FIRE_IGNITE_SPRING : FIRE_IGNITE_SPRING,
      extinguishParams: FIRE_EXTINGUISH_SPRING,
      isActiveZone: () => pointerActiveRef.current,
    };

    const handle = mountFireButton(
      btn,
      canvas,
      isPill ? FIRE_BTN_PILL : FIRE_BTN_CIRCLE,
      opts
    );
    handleRef.current = handle;
    if (!handle) return;

    if (!isIgnite) {
      // TopBar circle: instant lit — no spring lag after entry.
      // Landing pill: brief beat so the crown doesn't pop under the intro mark.
      if (isPill) {
        const t = window.setTimeout(() => {
          if (!dying) handle.setLit(true, 0.5);
        }, 120);
        return () => {
          window.clearTimeout(t);
          handle.destroy();
          handleRef.current = null;
        };
      }
      if (!dying) handle.setLit(true, 0.5, 'instant');
      return () => {
        handle.destroy();
        handleRef.current = null;
      };
    }

    handle.setLit(false, 0.5, 'instant');
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
  }, [isPill, isIgnite]);

  useEffect(() => {
    if (isIgnite) return;
    handleRef.current?.setLit(!dying, 0.5);
  }, [dying, isIgnite]);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (disabled || dying) return;
    const rect = btnRef.current?.getBoundingClientRect();
    const originX =
      e.detail === 0 || !rect || rect.width <= 0
        ? 0.5
        : Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    if (isIgnite) {
      handleRef.current?.setLit(true, originX);
      onClick(originX);
      return;
    }
    onClick(originX);
  };

  const headerClass = forcePill || isIgnite ? '' : 'fire-btn--header';
  const breathClass = isIgnite && !disabled ? 'fire-btn--breath' : '';
  // Circle in the top bar always gets the shorter crown clearance.
  const headerCircleClass = forceCircle ? 'fire-btn--header' : headerClass;

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
      className={`fire-btn burn-heat session-burn-target ${headerCircleClass} ${breathClass} ${
        isPill ? 'fire-btn--pill' : 'fire-btn--circle'
      } ${dying ? 'is-dying' : ''} ${className}`.trim()}
    >
      {/* Canvas behind plate — plate masks crown so flames only clear the top rim. */}
      <canvas ref={canvasRef} className="fire-canvas" aria-hidden="true" />
      {!isPill ? <span className="fire-btn__plate" aria-hidden="true" /> : null}
      <span className="btn-shine" aria-hidden="true" />
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
