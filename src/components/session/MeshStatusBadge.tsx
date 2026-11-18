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

  return (
    <p
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${tone}`}
      role="status"
    >
      {label}
    </p>
  );
}
