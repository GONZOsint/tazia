import { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { visualFromUserId } from '../../core/crypto/identity';
import { useT } from '../../i18n';
import type { MeshStatus, PresenceState } from '../../core/protocol';
import type { TrustStore } from '../../core/trust/trustStore';
import { Identicon } from '../../components/content/Identicon';
import { MeshStatusBadge } from '../../components/session/MeshStatusBadge';
import { TrustBadge } from '../../components/session/TrustBadge';
import { EmojiVerifyModal } from '../../components/session/EmojiVerifyModal';

function shortKeyFp(spkiB64: string): string {
  if (!spkiB64) return '—';
  const clean = spkiB64.replace(/[^a-zA-Z0-9]/g, '');
  return clean.slice(0, 8).toUpperCase();
}

interface PresenceViewProps {
  selfUserId: string | null;
  selfSignPubKeyB64: string | null;
  trustStore: TrustStore | null;
  presence: Record<string, PresenceState>;
  onlineUserIds: string[];
  meshStatus: MeshStatus;
  peerOnlineCount?: number;
  rejectedSyncCount: number;
  onSyncNow: () => Promise<void>;
  isSyncing: boolean;
  onGoToRooms?: () => void;
}

export function PresenceView({
  selfUserId,
  selfSignPubKeyB64,
  trustStore,
  presence,
  onlineUserIds,
  meshStatus,
  peerOnlineCount,
  rejectedSyncCount,
  onSyncNow,
  isSyncing,
  onGoToRooms,
}: PresenceViewProps) {
  const t = useT();
  const [visuals, setVisuals] = useState<
    Record<string, { fingerprintHex: string; identiconMatrix: boolean[] }>
  >({});
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [verifyPeer, setVerifyPeer] = useState<{ userId: string; alias: string; keyB64: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: typeof visuals = { ...visuals };
      for (const id of onlineUserIds) {
        if (next[id]) continue;
        next[id] = await visualFromUserId(id);
      }
      if (!cancelled) setVisuals(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineUserIds.join('|')]);

  if (!selfUserId) {
    return (
      <main className="mx-auto max-w-[720px] px-4 py-10 text-center sm:px-8">
        <Users className="mx-auto h-12 w-12 text-faint" aria-hidden="true" strokeWidth={1.5} />
        <h1 className="mt-4 font-display text-xl font-semibold text-ink">
          {t('presenceEmptyTitle')}
        </h1>
        {onGoToRooms && (
          <button
            type="button"
            onClick={onGoToRooms}
            aria-label={t('presenceEmptyCta')}
            className="btn-accent-sheen mt-5 inline-flex min-h-[48px] min-w-[48px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent"
          >
            <Users className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{t('presenceEmptyCta')}</span>
          </button>
        )}
      </main>
    );
  }

  const countLabel =
    onlineUserIds.length === 1
      ? t('presenceCount', { n: onlineUserIds.length })
      : t('presenceCountPlural', { n: onlineUserIds.length });

  const rejectedLabel =
    rejectedSyncCount === 1
      ? t('presenceRejected', { n: rejectedSyncCount })
      : t('presenceRejectedPlural', { n: rejectedSyncCount });

  return (
    <main className="mx-auto max-w-[720px] px-4 py-4 sm:px-8 sm:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{t('presenceTitle')}</h1>
          <p className="mt-1 text-sm text-muted">{countLabel}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <MeshStatusBadge
              status={meshStatus}
              onlineCount={peerOnlineCount ?? Math.max(0, onlineUserIds.length - 1)}
            />
            {rejectedSyncCount > 0 && (
              <p className="text-[11px] text-muted">{rejectedLabel}</p>
            )}
          </div>
          {(peerOnlineCount ?? Math.max(0, onlineUserIds.length - 1)) >= 5 && (
            <p className="mt-2 text-[11px] text-warn-ink" role="status">
              {t('roomsMeshLargeWarn', {
                n: peerOnlineCount ?? Math.max(0, onlineUserIds.length - 1),
              })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void onSyncNow()}
          disabled={isSyncing}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-ctrl)] border border-border bg-surface-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-bg focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
          {t('presenceRefresh')}
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {onlineUserIds.map((id) => {
          const alias =
            presence[id]?.alias || (id === selfUserId ? t('you') : t('presenceNoAlias'));
          const hasKey = Boolean(presence[id]?.signPubKeySpkiB64);
          const visual = visuals[id];
          const details = openDetails[id];
          return (
            <li
              key={id}
              className="rounded-xl border border-border bg-surface-raised px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {visual ? (
                  <Identicon matrix={visual.identiconMatrix} size={32} label={alias} />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-surface" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {alias}
                    {id === selfUserId ? t('presenceYou') : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {hasKey ? (
                      <p className="text-[11px] text-muted">
                        {t('presenceKeyShort', {
                          fp: shortKeyFp(presence[id].signPubKeySpkiB64),
                        })}
                      </p>
                    ) : (
                      id !== selfUserId && (
                        <p className="text-[10px] text-warn">{t('presenceNoKey')}</p>
                      )
                    )}
                    {trustStore && id !== selfUserId && trustStore.get(id) && (
                      <TrustBadge level={trustStore.get(id)!.level} />
                    )}
                  </div>
                </div>
                {id !== selfUserId && hasKey && selfSignPubKeyB64 && (
                  <button
                    type="button"
                    onClick={() =>
                      setVerifyPeer({
                        userId: id,
                        alias,
                        keyB64: presence[id].signPubKeySpkiB64,
                      })
                    }
                    className="min-h-[44px] rounded-lg px-2 text-[11px] font-medium text-ok focus-visible:outline-2 focus-visible:outline-accent"
                    title={t('trustVerifyTitle')}
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  aria-expanded={!!details}
                  onClick={() =>
                    setOpenDetails((prev) => ({ ...prev, [id]: !prev[id] }))
                  }
                  className="min-h-[44px] rounded-lg px-2 text-[11px] font-medium text-muted focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {details ? t('presenceHideDetails') : t('presenceDetails')}
                </button>
              </div>
              {details && (
                <p className="mt-2 break-all font-mono text-[11px] text-muted">{id}</p>
              )}
            </li>
          );
        })}
      </ul>

      {verifyPeer && selfSignPubKeyB64 && (
        <EmojiVerifyModal
          open={!!verifyPeer}
          peerAlias={verifyPeer.alias}
          selfKeyB64={selfSignPubKeyB64}
          peerKeyB64={verifyPeer.keyB64}
          onVerify={() => {
            trustStore?.verify(verifyPeer.userId);
            setVerifyPeer(null);
          }}
          onClose={() => setVerifyPeer(null)}
        />
      )}
    </main>
  );
}

export default PresenceView;
