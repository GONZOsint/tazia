import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { TAP, TAP_TRANSITION, iconSwap } from '../../motion/tokens';

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
  const prevVisible = useRef(visible);
  const [phraseMotion, setPhraseMotion] = useState<'ignite' | 'douse' | null>(null);

  useEffect(() => {
    if (prevVisible.current === visible) return;
    prevVisible.current = visible;
    setPhraseMotion(visible ? 'ignite' : 'douse');
    const id = window.setTimeout(() => setPhraseMotion(null), 300);
    return () => window.clearTimeout(id);
  }, [visible]);

  return (
    <div className="relative">
      <KeyRound
        className="pointer-events-none absolute top-1/2 left-3.5 z-10 h-4 w-4 -translate-y-1/2 text-faint"
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
        className={`input-base bg-bg pr-12 pl-10 focus:bg-surface-raised ${
          phraseMotion === 'ignite' ? 'phrase-ignite' : phraseMotion === 'douse' ? 'phrase-douse' : ''
        }`}
      />
      <motion.button
        whileTap={TAP}
        transition={TAP_TRANSITION}
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? t('phraseHide') : t('phraseShow')}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[var(--radius-ctrl)] text-muted transition-colors duration-[var(--dur-micro)] hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <AnimatePresence mode="wait" initial={false}>
          {visible ? (
            <motion.span
              key="hide"
              initial={iconSwap.initial}
              animate={iconSwap.animate}
              exit={iconSwap.exit}
              transition={iconSwap.transition}
            >
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            </motion.span>
          ) : (
            <motion.span
              key="show"
              initial={iconSwap.initial}
              animate={iconSwap.animate}
              exit={iconSwap.exit}
              transition={iconSwap.transition}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
