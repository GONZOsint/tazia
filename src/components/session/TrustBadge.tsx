import { useEffect, useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { TrustLevel } from '../../core/trust/trustStore';
import { useT } from '../../i18n';
import { DUR, EASE, badgePop } from '../../motion/tokens';

interface TrustBadgeProps {
  level: TrustLevel;
  className?: string;
}

const CONFIG: Record<
  TrustLevel,
  {
    Icon: typeof Shield;
    color: string;
    labelKey: 'trustNew' | 'trustTrusted' | 'trustVerified' | 'trustChanged';
  }
> = {
  new: { Icon: ShieldQuestion, color: 'text-muted', labelKey: 'trustNew' },
  trusted: { Icon: Shield, color: 'text-info', labelKey: 'trustTrusted' },
  verified: { Icon: ShieldCheck, color: 'text-ok', labelKey: 'trustVerified' },
  changed: { Icon: ShieldAlert, color: 'text-danger', labelKey: 'trustChanged' },
};

const POP_ANIMATE = {
  opacity: [0.5, 1, 1],
  scale: [0.82, 1.18, 1],
  filter: [
    'drop-shadow(0 0 0 transparent)',
    'drop-shadow(0 0 8px color-mix(in oklab, var(--color-accent) 55%, transparent))',
    'drop-shadow(0 0 0 transparent)',
  ],
};

const IDLE_ANIMATE = {
  opacity: 1,
  scale: 1,
  filter: 'none',
};

const POP_TRANSITION = { duration: DUR.pulse, ease: EASE.outExpo };

export function TrustBadge({ level, className = '' }: TrustBadgeProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const { Icon, color, labelKey } = CONFIG[level] ?? CONFIG.new;
  const label = t(labelKey);

  const [prevLevel, setPrevLevel] = useState(level);
  const [pop, setPop] = useState(false);

  if (prevLevel !== level) {
    setPrevLevel(level);
    setPop(level === 'verified' && !reduceMotion);
  }

  useEffect(() => {
    if (!pop) return;
    const id = window.setTimeout(() => setPop(false), Math.round(DUR.pulse * 1000));
    return () => window.clearTimeout(id);
  }, [pop]);

  const isPopping = pop && !reduceMotion;

  return (
    <motion.span
      role="img"
      aria-label={label}
      title={label}
      initial={false}
      className={`inline-flex shrink-0 items-center ${color} ${className}`}
      animate={isPopping ? POP_ANIMATE : IDLE_ANIMATE}
      transition={isPopping ? POP_TRANSITION : badgePop.transition}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
    </motion.span>
  );
}