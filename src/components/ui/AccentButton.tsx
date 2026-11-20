import type { ReactNode } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { TAP, TAP_TRANSITION } from '../../motion/tokens';

/**
 * Button scale (aligned with --tap-min / AccentButton):
 *   sm  44 — default controls, modals, toolbars
 *   md  48 — primary CTA in panels / empty states
 *   lg  52 — hero / full-bleed entry only
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

type BaseButtonProps = Omit<HTMLMotionProps<'button'>, 'size' | 'children'> & {
  children: ReactNode;
  size?: ButtonSize;
};

export type AccentButtonProps = BaseButtonProps;
export type SecondaryButtonProps = BaseButtonProps;

const SIZE: Record<ButtonSize, string> = {
  sm: 'min-h-[44px] px-4 py-2',
  md: 'min-h-[48px] px-5 py-2.5',
  lg: 'min-h-[52px] px-6 py-3',
};

const BTN_BASE =
  'inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-[var(--radius-ctrl)] type-ui font-semibold transition-colors duration-[var(--dur-micro)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50';

export function AccentButton({
  children,
  className = '',
  size = 'md',
  disabled,
  type = 'button',
  ...rest
}: AccentButtonProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type={type}
      whileTap={!disabled && !reduceMotion ? TAP : undefined}
      transition={TAP_TRANSITION}
      disabled={disabled}
      className={`btn-accent-sheen ${BTN_BASE} bg-accent text-on-accent hover:bg-accent-hover ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function SecondaryButton({
  children,
  className = '',
  size = 'sm',
  type = 'button',
  disabled,
  ...rest
}: SecondaryButtonProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type={type}
      whileTap={!disabled && !reduceMotion ? TAP : undefined}
      transition={TAP_TRANSITION}
      disabled={disabled}
      className={`${BTN_BASE} border border-border bg-bg text-ink hover:bg-surface ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export type EmptyZoneCtaProps = {
  icon: ReactNode;
  title: ReactNode;
  body: ReactNode;
  actionLabel: string;
  onAction: () => void;
  className?: string;
};

export function EmptyZoneCta({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  className = '',
}: EmptyZoneCtaProps) {
  return (
    <div className={`flex flex-col items-center px-4 py-16 text-center ${className}`}>
      <div className="mb-4 text-muted" aria-hidden="true">
        {icon}
      </div>
      <h2 className="type-title text-ink text-balance break-words">{title}</h2>
      <p className="type-lede mt-2 max-w-sm text-balance break-words">{body}</p>
      <AccentButton className="mt-6" onClick={onAction}>
        {actionLabel}
      </AccentButton>
    </div>
  );
}