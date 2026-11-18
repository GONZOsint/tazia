import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';

interface SecretPhraseInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
}

export function SecretPhraseInput({
  id,
  value,
  onChange,
  visible,
  onToggleVisible,
  placeholder = '',
  autoFocus = false,
  required = true,
}: SecretPhraseInputProps) {
  const t = useT();

  return (
    <div className="relative">
      <KeyRound
        className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-faint"
        aria-hidden="true"
      />
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[44px] w-full rounded-xl border border-border bg-bg pr-12 pl-10 py-2.5 text-[16px] text-ink transition-colors focus:border-ink focus:bg-surface-raised focus:outline-none focus:ring-1 focus:ring-accent/30"
      />
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? t('phraseHide') : t('phraseShow')}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <AnimatePresence mode="wait" initial={false}>
          {visible ? (
            <motion.span
              key="hide"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.12 }}
            >
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            </motion.span>
          ) : (
            <motion.span
              key="show"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.12 }}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
