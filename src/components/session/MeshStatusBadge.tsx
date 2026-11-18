import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useT } from '../../i18n';
import type { MeshStatus } from '../../core/protocol';

interface MeshStatusBadgeProps {
  status: MeshStatus;
  onlineCount: number;
  /** Icon + peer dots only; full label in aria/title. */
  compact?: boolean;
}

export function MeshStatusBadge({
  status,
  onlineCount,
  compact = false,
}: MeshStatusBadgeProps) {
  const t = useT();
  const label =
    status === 'connecting'
      ? t('meshConnecting')
      : status === 'alone'
        ? t('meshAlone')
        : status === 'syncing'
          ? t('meshSyncing')
          : t('meshConnected', { n: onlineCount });

  const tone =
    status === 'mesh'
      ? 'border-ok-border bg-ok-bg text-ok-ink'
      : status === 'syncing'
        ? 'border-info-border bg-info-bg text-info-ink'
        : status === 'alone'
          ? 'border-warn-border bg-warn-bg text-warn-ink'
          : 'border-border bg-surface text-muted';

  const StatusIcon =
    status === 'mesh'
      ? Wifi
      : status === 'syncing'
        ? Loader2
        : status === 'alone'
          ? WifiOff
          : Loader2;

  const peerDots = Math.min(Math.max(onlineCount, 0), 5);

  if (compact) {
    return (
      <p
        className={`inline-flex items-center gap-1.5 rounded-[var(--radius-ctrl)] border px-2 py-1 text-xs font-medium ${tone}`}
        role="status"
        aria-label={label}
        title={label}
      >
        {status === 'mesh' ? (
          <span className="mesh-radar-dot shrink-0" aria-hidden="true">
            <span />
          </span>
        ) : (
          <StatusIcon
            className={`h-3.5 w-3.5 shrink-0 ${status === 'syncing' || status === 'connecting' ? 'animate-spin' : ''}`}
            aria-hidden="true"
            strokeWidth={1.75}
          />
        )}
        {peerDots > 0 && (
          <span className="inline-flex items-center gap-0.5" aria-hidden="true">
            {Array.from({ length: peerDots }, (_, i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
            ))}
          </span>
        )}
      </p>
    );
  }

  return (
    <p
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-ctrl)] border px-2 py-1 text-xs font-medium ${tone}`}
      role="status"
      aria-label={label}
      title={label}
    >
      {status === 'mesh' ? (
        <span className="mesh-radar-dot shrink-0" aria-hidden="true">
          <span />
        </span>
      ) : (
        <span className="relative flex h-2 w-2 shrink-0">
          {status === 'syncing' && (
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-info opacity-75 motion-safe:animate-ping"
              aria-hidden="true"
            />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              status === 'syncing'
                ? 'bg-info'
                : status === 'alone'
                  ? 'bg-warn'
                  : 'bg-faint'
            }`}
          />
        </span>
      )}
      <StatusIcon
        className={`h-3.5 w-3.5 shrink-0 ${status === 'mesh' ? 'wifi-arc-1' : ''} ${
          status === 'syncing' || status === 'connecting' ? 'animate-spin' : ''
        }`}
        aria-hidden="true"
        strokeWidth={1.75}
      />
      <span>{label}</span>
    </p>
  );
}
