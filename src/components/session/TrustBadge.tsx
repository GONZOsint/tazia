import { useEffect, useRef, useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { motion } from 'motion/react';
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

export function TrustBadge({ level, className = '' }: TrustBadgeProps) {
  const t = useT();
  const { Icon, color, labelKey } = CONFIG[level];
  const label = t(labelKey);
  const prevLevel = useRef(level);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (prevLevel.current !== level && level === 'verified') {
      setPop(true);
      const id = window.setTimeout(() => setPop(false), DUR.pulse * 1000);
      prevLevel.current = level;
      return () => window.clearTimeout(id);
    }
    prevLevel.current = level;
  }, [level]);

  return (
    <motion.span
      className={`inline-flex items-center ${color} ${className}`}
      title={label}
      aria-label={label}
      animate={
        pop
          ? {
              opacity: [0.5, 1],
              scale: [0.82, 1.18, 1],
              filter: [
                'drop-shadow(0 0 0 transparent)',
                'drop-shadow(0 0 8px color-mix(in oklab, var(--color-accent) 55%, transparent))',
                'drop-shadow(0 0 0 transparent)',
              ],
            }
          : { opacity: 1, scale: 1, filter: 'drop-shadow(0 0 0 transparent)' }
      }
      transition={
        pop
          ? { duration: DUR.pulse, ease: EASE.outExpo }
          : badgePop.transition
      }
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </motion.span>
  );
}
