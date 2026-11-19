import { motion } from 'motion/react';
import { ZONE_BOOT } from '../../motion/tokens';

interface TaziaLogoProps {
  className?: string;
  size?: number;
  /**
   * Shared brand mark morph (hero ↔ TopBar).
   * Only one surface should enable this at a time so layoutId can hand off.
   */
  sharedMark?: boolean;
}

export function TaziaLogo({ className = '', size = 40, sharedMark = false }: TaziaLogoProps) {
  const base = import.meta.env.BASE_URL;
  // Dark mark keeps contrast on light and dark chrome; light JPG washes out on white.
  const src = `${base}brand/tazia-logo-dark.jpg`;
  const classes = `logo-mark rounded-[var(--radius-ctrl)] object-cover ring-1 ring-border ${className}`;

  if (sharedMark) {
    return (
      <motion.img
        layoutId={ZONE_BOOT.layoutId}
        src={src}
        alt="TAZIA"
        width={size}
        height={size}
        className={classes}
        decoding="async"
        transition={{ type: 'spring', visualDuration: 0.28, bounce: 0.12 }}
      />
    );
  }

  return (
    <img
      src={src}
      alt="TAZIA"
      width={size}
      height={size}
      className={classes}
      decoding="async"
    />
  );
}
