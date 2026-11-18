import type { ComponentType } from 'react';
import { Check, Copy } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';

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
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      type="button"
      onClick={() => void copyText(text, 'copy')}
      aria-label={iconOnly ? (copied ? copiedLabel : label) : undefined}
      title={title ?? (copied ? copiedLabel : label)}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.12 }}
            className="inline-flex items-center gap-1.5 text-ok"
          >
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {!iconOnly && <span>{copiedLabel}</span>}
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.12 }}
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
