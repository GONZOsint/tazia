import type { ComponentType } from 'react';
import { Check, Copy } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { TAP, TAP_TRANSITION, iconSwap } from '../../motion/tokens';

export type IconComp = ComponentType<{
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  strokeWidth?: number;
}>;

export interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  title?: string;
  className?: string;
  iconOnly?: boolean;
  disabled?: boolean;
  /** Idle icon (defaults to Copy). Copied state always uses Check. */
  icon?: IconComp;
}

export function CopyButton({
  text,
  label = 'Copiar',
  copiedLabel = 'Copiado',
  title,
  className = '',
  iconOnly = false,
  disabled = false,
  icon: IdleIcon = Copy,
}: CopyButtonProps) {
  const reduceMotion = useReducedMotion();
  const { isCopied, copyText } = useCopyFeedback();
  const copied = isCopied('copy');

  const swapInitial = reduceMotion ? { opacity: 0 } : iconSwap.initial;
  const swapAnimate = reduceMotion ? { opacity: 1 } : iconSwap.animate;
  const swapExit = reduceMotion ? { opacity: 0 } : iconSwap.exit;
  const swapTransition = reduceMotion ? { duration: 0.08 } : iconSwap.transition;

  return (
    <motion.button
      whileTap={disabled || reduceMotion ? undefined : TAP}
      transition={TAP_TRANSITION}
      type="button"
      disabled={disabled}
      data-copied={copied || undefined}
      onClick={() => {
        if (!disabled) void copyText(text, 'copy');
      }}
      title={title ?? (copied ? copiedLabel : label)}
      className={`inline-flex cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors duration-[var(--dur-micro)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {/* Nombre accesible estable en iconOnly y anuncio único al copiar */}
      {iconOnly && !copied && <span className="sr-only">{label}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ''}
      </span>

      <span className="inline-grid items-center justify-items-center">
        {!iconOnly && (
          <>
            <span
              aria-hidden="true"
              className="invisible col-start-1 row-start-1 inline-flex items-center gap-1.5"
            >
              <span className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </span>
            <span
              aria-hidden="true"
              className="invisible col-start-1 row-start-1 inline-flex items-center gap-1.5"
            >
              <span className="h-3.5 w-3.5 shrink-0" />
              <span>{copiedLabel}</span>
            </span>
          </>
        )}

        <span
          aria-hidden={copied || undefined}
          className="col-start-1 row-start-1 inline-flex items-center justify-center"
        >
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="copied"
                initial={swapInitial}
                animate={swapAnimate}
                exit={swapExit}
                transition={swapTransition}
                className="inline-flex items-center gap-1.5 text-ok"
              >
                <Check className="copy-ember-check h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {!iconOnly && <span>{copiedLabel}</span>}
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={swapInitial}
                animate={swapAnimate}
                exit={swapExit}
                transition={swapTransition}
                className="inline-flex items-center gap-1.5"
              >
                <IdleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
                {!iconOnly && <span>{label}</span>}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </span>
    </motion.button>
  );
}