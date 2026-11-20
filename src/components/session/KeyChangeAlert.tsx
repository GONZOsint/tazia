import { useId } from 'react';
import { Pin, ShieldAlert, Unplug, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useT } from '../../i18n';
import { TAP, TAP_TRANSITION } from '../../motion/tokens';

interface KeyChangeAlertProps {
  peerAlias: string;
  onRepin: () => void;
  onDisconnect: () => void;
  onDismiss: () => void;
}

export function KeyChangeAlert({
  peerAlias,
  onRepin,
  onDisconnect,
  onDismiss,
}: KeyChangeAlertProps) {
  const t = useT();
  const alertId = useId();

  return (
    <div
      role="region"
      aria-labelledby={alertId}
      className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-danger-border bg-danger-bg p-4"
    >
      <ShieldAlert
        className="mt-0.5 h-7 w-7 shrink-0 text-danger motion-safe:animate-pulse"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p
          id={alertId}
          role="alert"
          className="text-sm font-semibold leading-snug text-danger-ink break-words"
        >
          {t('trustKeyChanged', { alias: peerAlias })}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <motion.button
            whileTap={TAP}
            transition={TAP_TRANSITION}
            type="button"
            onClick={onRepin}
            className="inline-flex min-h-[44px] cursor-pointer select-none items-center justify-center gap-1.5 rounded-[var(--radius-ctrl)] border border-danger-border px-3 py-1.5 text-xs font-semibold text-danger-ink transition-colors hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Pin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t('trustRepin')}</span>
          </motion.button>
          <motion.button
            whileTap={TAP}
            transition={TAP_TRANSITION}
            type="button"
            onClick={onDisconnect}
            className="inline-flex min-h-[44px] cursor-pointer select-none items-center justify-center gap-1.5 rounded-[var(--radius-ctrl)] bg-danger px-3 py-1.5 text-xs font-semibold text-on-danger transition-colors hover:bg-danger/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Unplug className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t('trustDisconnect')}</span>
          </motion.button>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('dismissAlert')}
        title={t('dismissAlert')}
        className="icon-action icon-action--ghost pressable shrink-0 cursor-pointer text-danger-ink/60 transition-colors hover:text-danger-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}