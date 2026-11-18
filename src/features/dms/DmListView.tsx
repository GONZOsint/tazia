import { useEffect, useState } from 'react';
import { MessageCircle, Radio, Send } from 'lucide-react';
import { visualFromUserId } from '../../core/crypto/identity';
import type { DirectMessage, PresenceState } from '../../core/protocol';
import { useT } from '../../i18n';
import { Identicon } from '../../components/content/Identicon';

interface DmListViewProps {
  selfUserId: string | null;
  presence: Record<string, PresenceState>;
  onlineUserIds: string[];
  dmMessages: Record<string, DirectMessage[]>;
  dmUnread: Record<string, number>;
  onSelectPeer: (peerId: string) => void;
  onGoToRooms?: () => void;
}

export function DmListView({
  selfUserId,
  presence,
  onlineUserIds,
  dmMessages,
  dmUnread,
  onSelectPeer,
  onGoToRooms,
}: DmListViewProps) {
  const t = useT();
  const [visuals, setVisuals] = useState<
    Record<string, { identiconMatrix: boolean[] }>
  >({});

  const peerIds = Array.from(
    new Set([
      ...Object.keys(dmMessages),
      ...onlineUserIds.filter((id) => id !== selfUserId),
    ]),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: typeof visuals = { ...visuals };
      for (const id of peerIds) {
        if (next[id]) continue;
        next[id] = await visualFromUserId(id);
      }
      if (!cancelled) setVisuals(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerIds.join('|')]);

  if (!selfUserId) {
    return (
      <main className="mx-auto max-w-[720px] px-4 py-10 text-center sm:px-8">
        <MessageCircle className="mx-auto h-12 w-12 text-faint" aria-hidden="true" strokeWidth={1.5} />
        <h1 className="mt-4 font-display text-xl font-semibold text-ink">{t('dmsTitle')}</h1>
        {onGoToRooms && (
          <button
            type="button"
            onClick={onGoToRooms}
            aria-label={t('dmsEmptyCta')}
            className="btn-accent-sheen mt-5 inline-flex min-h-[48px] min-w-[48px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent"
          >
            <Radio className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{t('dmsEmptyCta')}</span>
          </button>
        )}
      </main>
    );
  }

  if (peerIds.length === 0) {
    return (
      <main className="mx-auto max-w-[720px] px-4 py-10 text-center sm:px-8">
        <MessageCircle className="mx-auto h-12 w-12 text-faint" aria-hidden="true" strokeWidth={1.5} />
        <h1 className="mt-4 font-display text-xl font-semibold text-ink">{t('dmsTitle')}</h1>
        <p className="mt-2 text-sm text-muted">{t('dmsNoOnline')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[720px] px-4 py-4 sm:px-8 sm:py-6">
      <h1 className="font-display text-2xl font-bold text-ink">{t('dmsTitle')}</h1>
      <p className="mt-1 text-sm text-muted">{t('dmsStartChat')}</p>

      <ul className="mt-3 space-y-1.5">
        {peerIds.map((id) => {
          const alias = presence[id]?.alias || t('presenceNoAlias');
          const visual = visuals[id];
          const msgs = dmMessages[id] ?? [];
          const lastMsg = msgs[msgs.length - 1];
          const unread = dmUnread[id] ?? 0;
          const isOnline = onlineUserIds.includes(id);

          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelectPeer(id)}
                className="flex w-full min-h-[60px] items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-left hover:bg-bg focus-visible:outline-2 focus-visible:outline-accent"
              >
                <div className="relative">
                  {visual ? (
                    <Identicon matrix={visual.identiconMatrix} size={36} label={alias} />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-surface" />
                  )}
                  {isOnline && (
                    <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface-raised bg-green-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{alias}</p>
                  {lastMsg && (
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {lastMsg.fromUserId === selfUserId ? `${t('you')}: ` : ''}
                      {lastMsg.body}
                    </p>
                  )}
                </div>
                {unread > 0 && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent">
                    {unread}
                  </span>
                )}
                <Send className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

export default DmListView;
