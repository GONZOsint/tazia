import { useEffect, useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { visualFromUserId, type PeerVisual } from '../../core/crypto/identity';
import type { DirectMessage, PresenceState } from '../../core/protocol';
import { useLocale, useT } from '../../i18n';
import { formatClockTime } from '../../core/utils/inviteLink';
import { EmptyZoneCta } from '../../components/ui/AccentButton';
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
  const { locale } = useLocale();
  const [visuals, setVisuals] = useState<Record<string, PeerVisual>>({});

  const peerIds = useMemo(() => {
    const ids = Array.from(
      new Set([
        ...Object.keys(dmMessages),
        ...onlineUserIds.filter((id) => id !== selfUserId),
      ]),
    );
    ids.sort((a, b) => {
      const aLast = dmMessages[a]?.[dmMessages[a].length - 1]?.createdAtMs ?? 0;
      const bLast = dmMessages[b]?.[dmMessages[b].length - 1]?.createdAtMs ?? 0;
      if (bLast !== aLast) return bLast - aLast;
      const aUnread = dmUnread[a] ?? 0;
      const bUnread = dmUnread[b] ?? 0;
      if (bUnread !== aUnread) return bUnread - aUnread;
      const aOnline = onlineUserIds.includes(a) ? 1 : 0;
      const bOnline = onlineUserIds.includes(b) ? 1 : 0;
      return bOnline - aOnline;
    });
    return ids;
  }, [dmMessages, dmUnread, onlineUserIds, selfUserId]);

  const hasAnyThread = peerIds.some((id) => (dmMessages[id]?.length ?? 0) > 0);

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
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peerIds.join('|')]);

  if (!selfUserId) {
    return (
      <EmptyZoneCta
        icon={<MessageCircle className="h-12 w-12 text-faint" aria-hidden="true" strokeWidth={1.5} />}
        title={t('dmsNeedZoneTitle')}
        body={t('dmsNeedZoneBody')}
        actionLabel={t('dmsEmptyCta')}
        onAction={() => onGoToRooms?.()}
      />
    );
  }

  if (peerIds.length === 0) {
    return (
      <main className="mx-auto max-w-[720px] px-4 py-10 text-center sm:px-8">
        <MessageCircle className="mx-auto h-12 w-12 text-faint" aria-hidden="true" strokeWidth={1.5} />
        <h1 className="type-headline mt-4 text-ink">{t('dmsTitle')}</h1>
        <p className="type-lede mt-2">{t('dmsNoOnline')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[720px] px-4 py-4 sm:px-8 sm:py-6">
      <h1 className="type-headline text-ink">{t('dmsTitle')}</h1>
      <p className="type-caption mt-1">
        {hasAnyThread ? t('dmsStartChat') : t('dmsEmpty')}
      </p>

      <ul className="mt-3 space-y-1.5" role="list">
        {peerIds.map((id) => {
          const visual = visuals[id];
          const alias =
            presence[id]?.alias || visual?.suggestedAlias || t('presenceNoAlias');
          const msgs = dmMessages[id] ?? [];
          const lastMsg = msgs[msgs.length - 1];
          const unread = dmUnread[id] ?? 0;
          const isOnline = onlineUserIds.includes(id);

          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelectPeer(id)}
                aria-label={
                  unread > 0
                    ? `${alias} — ${t('dmsUnread', { n: unread })}`
                    : isOnline
                      ? `${alias} — ${t('peerOnline')}`
                      : alias
                }
                className={`list-row pressable flex w-full min-h-[64px] items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-accent ${
                  unread > 0 ? 'ring-1 ring-accent/35' : ''
                }`}
              >
                <div className="relative shrink-0">
                  {visual ? (
                    <Identicon
                      matrix={visual.identiconMatrix}
                      size={36}
                      label={alias}
                      fg={visual.fg}
                      bg={visual.bg}
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-[var(--radius-ctrl)] bg-surface" />
                  )}
                  {isOnline && (
                    <span
                      className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface-raised bg-ok"
                      title={t('peerOnline')}
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`min-w-0 truncate text-sm text-ink ${
                        unread > 0 ? 'font-bold' : 'font-semibold'
                      }`}
                    >
                      {alias}
                    </p>
                    {lastMsg && (
                      <time
                        className="type-caption shrink-0 tabular-nums"
                        dateTime={new Date(lastMsg.createdAtMs).toISOString()}
                      >
                        {formatClockTime(lastMsg.createdAtMs, locale)}
                      </time>
                    )}
                  </div>
                  {lastMsg ? (
                    <p
                      className={`type-caption mt-0.5 truncate ${
                        unread > 0 ? 'font-medium text-ink/80' : ''
                      }`}
                    >
                      {lastMsg.fromUserId === selfUserId ? `${t('you')}: ` : ''}
                      {lastMsg.body}
                    </p>
                  ) : (
                    <p className="type-caption mt-0.5 truncate">{t('dmsStartChat')}</p>
                  )}
                </div>
                {unread > 0 && (
                  <span className="type-badge shrink-0 rounded-full bg-accent px-2 py-0.5 text-on-accent">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

export default DmListView;
