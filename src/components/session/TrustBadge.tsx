import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import type { TrustLevel } from '../../core/trust/trustStore';
import { useT } from '../../i18n';

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

  return (
    <span
      className={`inline-flex items-center ${color} ${className}`}
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}
