import { useEffect, useState, type InputHTMLAttributes, type Ref } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useT } from '../../i18n';
import { DUR, TAP, TAP_TRANSITION, iconSwap } from '../../motion/tokens';

/** Match phrase-ignite / phrase-douse (--dur-ritual). */
const PHRASE_MOTION_MS = Math.round(DUR.ritual * 1000);

export interface SecretPhraseInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'id' | 'value' | 'onChange' | 'type' | 'className'
  > {
  id: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  className?: string;
  inputClassName?: string;
  ref?: Ref<HTMLInputElement>;
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
  disabled = false,
  className = '',
  inputClassName = '',
  ref,
  ...inputProps
}: SecretPhraseInputProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [prevVisible, setPrevVisible] = useState(visible);
  const [phraseMotion, setPhraseMotion] = useState<'ignite' | 'douse' | null>(null);

  if (prevVisible !== visible) {
    setPrevVisible(visible);
    setPhraseMotion(reduceMotion ? null : visible ? 'ignite' : 'douse');
  } else if (reduceMotion && phraseMotion !== null) {
    setPhraseMotion(null);
  }

  useEffect(() => {
    if (!phraseMotion) return;
    const timer = window.setTimeout(() => setPhraseMotion(null), PHRASE_MOTION_MS);
    return () => window.clearTimeout(timer);
  }, [phraseMotion]);

  const toggleLabel = visible ? t('phraseHide') : t('phraseShow');
  const motionClass =
    phraseMotion === 'ignite'
      ? 'phrase-ignite'
      : phraseMotion === 'douse'
        ? 'phrase-douse'
        : '';

  const swapInitial = reduceMotion ? { opacity: 0 } : iconSwap.initial;
  const swapAnimate = reduceMotion ? { opacity: 1 } : iconSwap.animate;
  const swapExit = reduceMotion ? { opacity: 0 } : iconSwap.exit;
  const swapTransition = reduceMotion ? { duration: 0.08 } : iconSwap.transition;

  return (
    <div className={`relative isolate ${className}`}>
      <KeyRound
        className={`pointer-events-none absolute top-1/2 left-3.5 z-[1] h-4 w-4 -translate-y-1/2 text-faint ${
          disabled ? 'opacity-50' : ''
        }`}
        aria-hidden="true"
      />
      <input
        ref={ref}
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-1p-ignore="true"
        data-lpignore="true"
        data-form-type="other"
        name={`${id}-zone-phrase`}
        className={`input-base bg-bg pr-12 pl-10 focus:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50 ${motionClass} ${inputClassName}`}
        {...inputProps}
      />
      <motion.button
        whileTap={disabled || reduceMotion ? undefined : TAP}
        transition={TAP_TRANSITION}
        type="button"
        disabled={disabled}
        onClick={onToggleVisible}
        aria-controls={id}
        aria-label={toggleLabel}
        title={toggleLabel}
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer select-none items-center justify-center rounded-r-[var(--radius-ctrl)] text-muted transition-colors duration-[var(--dur-micro)] hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <AnimatePresence mode="wait" initial={false}>
          {visible ? (
            <motion.span
              key="hide"
              initial={swapInitial}
              animate={swapAnimate}
              exit={swapExit}
              transition={swapTransition}
              className="inline-flex items-center justify-center"
            >
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            </motion.span>
          ) : (
            <motion.span
              key="show"
              initial={swapInitial}
              animate={swapAnimate}
              exit={swapExit}
              transition={swapTransition}
              className="inline-flex items-center justify-center"
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}