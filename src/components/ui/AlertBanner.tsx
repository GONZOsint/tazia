import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';

type AlertTone = 'error' | 'warning' | 'success' | 'info';

const TONE: Record<
  AlertTone,
  { wrap: string; Icon: typeof AlertCircle }
> = {
  error: {
    wrap: 'border-danger-border bg-danger-bg text-danger-ink',
    Icon: AlertCircle,
  },
  warning: {
    wrap: 'border-warn-border bg-warn-bg text-warn-ink',
    Icon: AlertCircle,
  },
  success: {
    wrap: 'border-ok-border bg-ok-bg text-ok-ink',
    Icon: CheckCircle2,
  },
  info: {
    wrap: 'border-info-border bg-info-bg text-info-ink',
    Icon: Info,
  },
};

interface AlertBannerProps {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
  role?: 'alert' | 'status';
}

export function AlertBanner({
  tone = 'error',
  children,
  className = '',
  role = 'alert',
}: AlertBannerProps) {
  const { wrap, Icon } = TONE[tone];
  return (
    <div
      role={role}
      className={`flex items-start gap-2.5 rounded-[var(--radius-panel)] border px-4 py-3 text-xs font-medium sm:text-sm ${wrap} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
