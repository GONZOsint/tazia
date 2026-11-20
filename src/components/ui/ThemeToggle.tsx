import { Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { useT } from '../../i18n';
import { TAP, TAP_TRANSITION, iconSwap } from '../../motion/tokens';
import { useTheme } from '../../theme';

export type ThemeToggleProps = Omit<HTMLMotionProps<'button'>, 'children'>;

export function ThemeToggle({
  className = '',
  disabled,
  onClick,
  ...rest
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const t = useT();
  const reduceMotion = useReducedMotion();
  const isDark = theme === 'dark';

  return (
    <motion.button
      whileTap={disabled || reduceMotion ? undefined : TAP}
      transition={TAP_TRANSITION}
      type="button"
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) toggleTheme();
      }}
      aria-label={t('themeToggleAria')}
      aria-pressed={isDark}
      title={isDark ? t('themeLight') : t('themeDark')}
      className={`inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 cursor-pointer select-none items-center justify-center rounded-[var(--radius-ctrl)] border border-border bg-surface text-ink transition-colors duration-[var(--dur-micro)] hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...rest}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'sun' : 'moon'}
          initial={reduceMotion ? { opacity: 0 } : { ...iconSwap.initial, rotate: -20 }}
          animate={reduceMotion ? { opacity: 1 } : { ...iconSwap.animate, rotate: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { ...iconSwap.exit, rotate: 28 }}
          transition={reduceMotion ? { duration: 0.08 } : iconSwap.transition}
          className="inline-flex items-center justify-center"
        >
          {isDark ? (
            <Sun className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}