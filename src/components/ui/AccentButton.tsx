import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'motion/react';
import { TAP, TAP_TRANSITION } from '../../motion/tokens';

type AccentButtonProps = {
  children: ReactNode;
  className?: string;
  size?: 'md' | 'lg';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
};

const SIZE = {
  md: 'min-h-[48px] px-5 py-2.5 text-sm',
  lg: 'min-h-[52px] px-6 py-3 text-sm',
} as const;

export function AccentButton({
  children,
  className = '',
  size = 'md',
  disabled,
  type = 'button',
  onClick,
}: AccentButtonProps) {
  return (
    <motion.button
      type={type}
      whileTap={!disabled ? TAP : undefined}
      transition={TAP_TRANSITION}
      disabled={disabled}
      onClick={onClick}
      className={`btn-accent-sheen inline-flex items-center justify-center gap-2 rounded-[var(--radius-ctrl)] bg-accent font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${SIZE[size]} ${className}`}
    >
      {children}
    </motion.button>
  );
}

type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function SecondaryButton({
  children,
  className = '',
  type = 'button',
  ...rest
}: SecondaryButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] border border-border bg-surface-raised px-4 py-2.5 text-sm font-semibold text-ink hover:bg-bg focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

type EmptyZoneCtaProps = {
  icon: ReactNode;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
};

export function EmptyZoneCta({ icon, title, body, actionLabel, onAction }: EmptyZoneCtaProps) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      <div className="mb-4 text-muted">{icon}</div>
      <h2 className="type-title text-ink">{title}</h2>
      <p className="type-lede mt-2 max-w-sm">{body}</p>
      <AccentButton className="mt-6" onClick={onAction}>
        {actionLabel}
      </AccentButton>
    </div>
  );
}
