import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useT } from '../../i18n';
import type { MeshStatus } from '../../core/protocol';

interface MeshStatusBadgeProps {
  status: MeshStatus;
  onlineCount: number;
}

export function MeshStatusBadge({ status, onlineCount }: MeshStatusBadgeProps) {
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

  const dotColor =
    status === 'mesh'
      ? 'bg-green-500'
      : status === 'syncing'
        ? 'bg-blue-400'
        : status === 'alone'
          ? 'bg-amber-400'
          : 'bg-zinc-400';

  const StatusIcon =
    status === 'mesh'
      ? Wifi
      : status === 'syncing'
        ? Loader2
        : status === 'alone'
          ? WifiOff
          : Loader2;

  return (
    <p
      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium ${tone}`}
      role="status"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping ${dotColor}`}
        />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
      </span>
      <StatusIcon
        className={`h-3.5 w-3.5 shrink-0 ${status === 'syncing' || status === 'connecting' ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      {label}
    </p>
  );
}
