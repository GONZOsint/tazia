import { Pin, ShieldAlert, Unplug, X } from 'lucide-react';
import { useT } from '../../i18n';

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

  return (
    <div className="flex items-start gap-3 rounded-xl border border-danger-border bg-danger-bg p-4">
      <ShieldAlert
        className="mt-0.5 h-7 w-7 shrink-0 text-danger motion-safe:animate-pulse"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-danger-ink">{t('trustKeyChanged', { alias: peerAlias })}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRepin}
            aria-label={t('trustRepin')}
            title={t('trustRepin')}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-danger-border px-3 py-1 text-xs font-semibold text-danger-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Pin className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t('trustRepin')}</span>
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            aria-label={t('trustDisconnect')}
            title={t('trustDisconnect')}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-danger px-3 py-1 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Unplug className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t('trustDisconnect')}</span>
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('dismissAlert')}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-danger-ink/60 focus-visible:outline-2 focus-visible:outline-accent"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
