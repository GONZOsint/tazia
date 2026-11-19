import type { ComponentType } from 'react';
import { Check, Copy } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { TAP, TAP_TRANSITION, iconSwap } from '../../motion/tokens';

type IconComp = ComponentType<{
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
  strokeWidth?: number;
}>;

interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  title?: string;
  className?: string;
  iconOnly?: boolean;
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
  icon: IdleIcon = Copy,
}: CopyButtonProps) {
  const { isCopied, copyText } = useCopyFeedback();
  const copied = isCopied('copy');

  return (
    <motion.button
      whileTap={TAP}
      transition={TAP_TRANSITION}
      type="button"
      onClick={() => void copyText(text, 'copy')}
      aria-label={iconOnly ? (copied ? copiedLabel : label) : undefined}
      title={title ?? (copied ? copiedLabel : label)}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors duration-[var(--dur-micro)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={iconSwap.initial}
            animate={iconSwap.animate}
            exit={iconSwap.exit}
            transition={iconSwap.transition}
            className="inline-flex items-center gap-1.5 text-ok"
          >
            <Check className="copy-ember-check h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {!iconOnly && <span>{copiedLabel}</span>}
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={iconSwap.initial}
            animate={iconSwap.animate}
            exit={iconSwap.exit}
            transition={iconSwap.transition}
            className="inline-flex items-center gap-1.5"
          >
            <IdleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
            {!iconOnly && <span>{label}</span>}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
