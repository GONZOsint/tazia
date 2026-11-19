import { motion } from 'motion/react';
import { ZONE_BOOT } from '../../motion/tokens';
import { TaziaMark } from './TaziaMark';

interface TaziaLogoProps {
  className?: string;
  size?: number;
  /**
   * Shared brand mark morph (hero ↔ TopBar).
   * Only one surface should enable this at a time so layoutId can hand off.
   */
  sharedMark?: boolean;
}

/** Brand mark on the dark plate (matches historic JPG framing). */
export function TaziaLogo({ className = '', size = 40, sharedMark = false }: TaziaLogoProps) {
  const classes = `logo-mark inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-ctrl)] bg-black ring-1 ring-border ${className}`;

  if (sharedMark) {
    return (
      <motion.span
        layoutId={ZONE_BOOT.layoutId}
        className={classes}
        style={{ width: size, height: size }}
        transition={{ type: 'spring', visualDuration: 0.28, bounce: 0.12 }}
        role="img"
        aria-label="TAZIA"
      >
        <TaziaMark size={size} labelled={false} />
      </motion.span>
    );
  }

  return (
    <span className={classes} style={{ width: size, height: size }} role="img" aria-label="TAZIA">
      <TaziaMark size={size} labelled={false} />
    </span>
  );
}
