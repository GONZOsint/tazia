import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { motion } from 'motion/react';
import { TAP, TAP_TRANSITION } from '../../motion/tokens';

/**
 * Button scale (aligned with --tap-min / AccentButton):
 *   sm  44 — default controls, modals, toolbars
 *   md  48 — primary CTA in panels / empty states
 *   lg  52 — hero / full-bleed entry only
 */
type ButtonSize = 'sm' | 'md' | 'lg';

type AccentButtonProps = {
  children: ReactNode;
  className?: string;
  size?: ButtonSize;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-4 py-2',
  md: 'min-h-[48px] px-5 py-2.5',
  lg: 'min-h-[52px] px-6 py-3',
};

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-ctrl)] type-ui font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50';

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
      className={`btn-accent-sheen ${BTN_BASE} bg-accent text-on-accent hover:bg-accent-hover ${SIZE[size]} ${className}`}
    >
      {children}
    </motion.button>
  );
}

type SecondaryButtonProps = {
  children: ReactNode;
  className?: string;
  size?: ButtonSize;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
};

export function SecondaryButton({
  children,
  className = '',
  size = 'sm',
  type = 'button',
  disabled,
  onClick,
}: SecondaryButtonProps) {
  return (
    <motion.button
      type={type}
      whileTap={!disabled ? TAP : undefined}
      transition={TAP_TRANSITION}
      disabled={disabled}
      onClick={onClick}
      className={`${BTN_BASE} border border-border bg-bg text-ink hover:bg-surface ${SIZE[size]} ${className}`}
    >
      {children}
    </motion.button>
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
