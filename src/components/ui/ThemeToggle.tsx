import { Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { TAP, TAP_TRANSITION, iconSwap } from '../../motion/tokens';
import { useTheme } from '../../theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const t = useT();
  const isDark = theme === 'dark';

  return (
    <motion.button
      whileTap={TAP}
      transition={TAP_TRANSITION}
      type="button"
      onClick={toggleTheme}
      aria-label={t('themeToggleAria')}
      title={isDark ? t('themeLight') : t('themeDark')}
      className={`inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-[var(--radius-ctrl)] border border-border bg-surface text-ink hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'sun' : 'moon'}
          initial={{ ...iconSwap.initial, rotate: -20 }}
          animate={{ ...iconSwap.animate, rotate: 0 }}
          exit={{ ...iconSwap.exit, rotate: 28 }}
          transition={iconSwap.transition}
          className="inline-flex"
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
