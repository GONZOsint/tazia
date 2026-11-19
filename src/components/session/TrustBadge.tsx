import { useEffect, useRef, useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { motion } from 'motion/react';
import type { TrustLevel } from '../../core/trust/trustStore';
import { useT } from '../../i18n';
import { DUR, EASE } from '../../motion/tokens';

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
      const id = window.setTimeout(() => setPop(false), 420);
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
          ? { opacity: [0.5, 1], scale: [0.85, 1.12, 1] }
          : { opacity: 1, scale: 1 }
      }
      transition={{ duration: DUR.medium, ease: EASE.outExpo }}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </motion.span>
  );
}
