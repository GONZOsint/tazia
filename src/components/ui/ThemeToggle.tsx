import { Moon, Sun } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const t = useT();
  const isDark = theme === 'dark';

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      type="button"
      onClick={toggleTheme}
      aria-label={t('themeToggleAria')}
      title={isDark ? t('themeLight') : t('themeDark')}
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[var(--radius-ctrl)] border border-border bg-surface text-ink hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'sun' : 'moon'}
          initial={{ opacity: 0, rotate: -20, scale: 0.85 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 20, scale: 0.85 }}
          transition={{ duration: 0.15 }}
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
