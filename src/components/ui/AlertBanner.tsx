import { AlertCircle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';

export type AlertTone = 'error' | 'warning' | 'success' | 'info';

const TONE: Record<
  AlertTone,
  { wrap: string; Icon: typeof AlertCircle; defaultRole: 'alert' | 'status' }
> = {
  error: {
    wrap: 'border-danger-border bg-danger-bg text-danger-ink',
    Icon: AlertCircle,
    defaultRole: 'alert',
  },
  warning: {
    wrap: 'border-warn-border bg-warn-bg text-warn-ink',
    Icon: ShieldAlert,
    defaultRole: 'alert',
  },
  success: {
    wrap: 'border-ok-border bg-ok-bg text-ok-ink',
    Icon: CheckCircle2,
    defaultRole: 'status',
  },
  info: {
    wrap: 'border-info-border bg-info-bg text-info-ink',
    Icon: Info,
    defaultRole: 'status',
  },
};

export interface AlertBannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  tone?: AlertTone;
  children: ReactNode;
  role?: 'alert' | 'status' | 'note';
}

export function AlertBanner({
  tone = 'error',
  children,
  className = '',
  role,
  ...rest
}: AlertBannerProps) {
  const { wrap, Icon, defaultRole } = TONE[tone] ?? TONE.error;

  return (
    <div
      role={role ?? defaultRole}
      className={`flex items-start gap-2.5 rounded-[var(--radius-panel)] border px-4 py-3 text-xs font-medium leading-snug sm:text-sm ${wrap} ${className}`}
      {...rest}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}