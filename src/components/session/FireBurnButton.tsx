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

interface FireBurnButtonProps {
  label: string;
  onClick: () => void;
  /** Session extinguish choreography — visually put the flame out. */
  dying?: boolean;
  disabled?: boolean;
}

function useIsPill(): boolean {
  const [pill, setPill] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const onChange = () => setPill(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return pill;
}

/**
 * Session “apagar llama” control — accent fire button with WebGL flame crown
 * (mockup). Lit while the zone is alive; extinguishes when `dying`.
 */
export function FireBurnButton({
  label,
  onClick,
  dying = false,
  disabled = false,
}: FireBurnButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<FireButtonHandle | null>(null);
  const isPill = useIsPill();

  useEffect(() => {
    const btn = btnRef.current;
    const canvas = canvasRef.current;
    if (!btn || !canvas) return;

    const handle = mountFireButton(btn, canvas, isPill ? FIRE_BTN_PILL : FIRE_BTN_CIRCLE);
    handleRef.current = handle;
    if (!handle) return;

    // Auto-ignite shortly after mount (session is already alive).
    const t = window.setTimeout(() => {
      if (!dying) handle.setLit(true, 0.5);
    }, isPill ? 320 : 180);

    return () => {
      window.clearTimeout(t);
      handle.destroy();
      handleRef.current = null;
    };
    // Remount when circle ↔ pill geometry changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dying driven below
  }, [isPill]);

  useEffect(() => {
    handleRef.current?.setLit(!dying, 0.5);
  }, [dying]);

  return (
    <motion.button
      ref={btnRef}
      whileTap={dying || disabled ? undefined : TAP}
      transition={TAP_TRANSITION}
      type="button"
      onClick={onClick}
      disabled={disabled || dying}
      aria-label={label}
      title={label}
      aria-pressed={!dying}
      className={`fire-btn fire-btn--header burn-heat session-burn-target ${
        isPill ? 'fire-btn--pill' : 'fire-btn--circle'
      } ${dying ? 'is-dying' : ''}`}
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
