import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { visualFromUserId, type PeerVisual } from '../../core/crypto/identity';
import type { DirectMessage, PresenceState } from '../../core/protocol';
import type { TrustStore } from '../../core/trust/trustStore';
import { useLocale, useT } from '../../i18n';
import { formatClockTime } from '../../core/utils/inviteLink';
import { EmptyZoneCta } from '../../components/ui/AccentButton';
import { PeerAvatar } from '../../components/content/PeerAvatar';
import {
  resolvePeerAvatarSeed,
  rememberPeerAvatarSeed,
} from '../../core/avatar/peerSeedCache';
import { DUR, EASE, listRowEnter, peerRowExit } from '../../motion/tokens';

export interface DmListViewProps {
  selfUserId: string | null;
  presence: Record<string, PresenceState>;
  onlineUserIds: string[];
  dmMessages: Record<string, DirectMessage[]>;
  dmUnread: Record<string, number>;
  trustStore?: TrustStore | null;
  onSelectPeer: (peerId: string) => void;
  onGoToRooms?: () => void;
}

export function DmListView({
  selfUserId,
  presence,
  onlineUserIds,
  dmMessages,
  dmUnread,
  trustStore = null,
  onSelectPeer,
  onGoToRooms,
}: DmListViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const [visuals, setVisuals] = useState<Record<string, PeerVisual>>({});
  const [trustTick, setTrustTick] = useState(0);

  useEffect(() => {
    if (!trustStore) return;
    return trustStore.onChange(() => setTrustTick((n) => n + 1));
  }, [trustStore]);

  const onlineSet = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);

  const peerIds = useMemo(() => {
    const ids = Array.from(
      new Set([...Object.keys(dmMessages), ...onlineUserIds]),
    ).filter((id) => id !== selfUserId);

    ids.sort((a, b) => {
      const aMsgs = dmMessages[a];
      const bMsgs = dmMessages[b];
      const aLast = aMsgs?.length ? aMsgs[aMsgs.length - 1]!.createdAtMs : 0;
      const bLast = bMsgs?.length ? bMsgs[bMsgs.length - 1]!.createdAtMs : 0;
      if (bLast !== aLast) return bLast - aLast;
      const aUnread = dmUnread[a] ?? 0;
      const bUnread = dmUnread[b] ?? 0;
      if (bUnread !== aUnread) return bUnread - aUnread;
      const aOnline = onlineSet.has(a) ? 1 : 0;
      const bOnline = onlineSet.has(b) ? 1 : 0;
      return bOnline - aOnline;
    });
    return ids;
  }, [dmMessages, dmUnread, onlineSet, onlineUserIds, selfUserId]);

  const hasAnyThread = peerIds.some((id) => (dmMessages[id]?.length ?? 0) > 0);

  const missingKey = useMemo(
    () => peerIds.filter((id) => !visuals[id]).join('|'),
    [peerIds, visuals],
  );

  useEffect(() => {
    if (!missingKey) return;
    let cancelled = false;
    const ids = missingKey.split('|');

    void Promise.all(ids.map(async (id) => [id, await visualFromUserId(id)] as const)).then(
      (entries) => {
        if (cancelled) return;
        setVisuals((prev) => {
          const next = { ...prev };
          for (const [id, visual] of entries) {
            next[id] = visual;
          }
          return next;
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  useEffect(() => {
    for (const [id, state] of Object.entries(presence)) {
      if (state.avatarSeed) rememberPeerAvatarSeed(id, state.avatarSeed);
    }
  }, [presence]);

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
      <p className="type-caption mt-1 max-w-[36rem] text-pretty">
        {hasAnyThread ? t('dmsStartChat') : t('dmsEmpty')}
      </p>

      <ul className="mt-4 space-y-1" role="list">
        <AnimatePresence mode="popLayout" initial={false}>
          {peerIds.map((id) => {
            const peerPresence = presence[id];
            const visual = visuals[id];
            const alias =
              peerPresence?.alias || visual?.suggestedAlias || t('presenceNoAlias');
            const msgs = dmMessages[id] ?? [];
            const lastMsg = msgs.length ? msgs[msgs.length - 1] : undefined;
            const unread = dmUnread[id] ?? 0;
            const isOnline = onlineSet.has(id);
            const verified = trustTick >= 0 && trustStore?.getLevel(id) === 'verified';

            const accessibleLabel = [
              alias,
              verified ? t('trustVerified') : null,
              isOnline ? t('peerOnline') : null,
              unread > 0 ? t('dmsUnread', { n: unread }) : null,
            ]
              .filter(Boolean)
              .join(' — ');

            return (
              <motion.li
                key={id}
                layout={!reduceMotion}
                initial={reduceMotion ? { opacity: 0 } : listRowEnter.initial}
                animate={reduceMotion ? { opacity: 1 } : listRowEnter.animate}
                exit={
                  reduceMotion
                    ? { opacity: 0, transition: { duration: DUR.micro, ease: EASE.easeIn } }
                    : peerRowExit
                }
              >
                <div
                  className={`list-row pressable relative flex min-h-[64px] w-full items-center gap-3 px-3.5 py-2.5 text-left ${
                    unread > 0 ? 'ring-1 ring-accent/40' : ''
                  }`}
                >
                  <div className="relative z-[1] shrink-0">
                    <PeerAvatar
                      avatarSeed={resolvePeerAvatarSeed(peerPresence?.avatarSeed, id)}
                      matrix={visual?.identiconMatrix}
                      size={36}
                      label={alias}
                      fg={visual?.fg}
                      bg={visual?.bg}
                      animated={false}
                    />
                    {isOnline && (
                      <span
                        className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-raised bg-ok"
                        title={t('peerOnline')}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectPeer(id)}
                    aria-label={accessibleLabel}
                    className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-3 rounded-sm text-left before:absolute before:inset-0 before:rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p
                          className={`inline-flex min-w-0 max-w-full items-center gap-1 text-sm text-ink ${
                            unread > 0 ? 'font-bold' : 'font-semibold'
                          }`}
                        >
                          <span className="truncate">{alias}</span>
                          {verified && (
                            <ShieldCheck
                              className="h-3.5 w-3.5 shrink-0 text-ok"
                              aria-hidden="true"
                              strokeWidth={2.25}
                            />
                          )}
                        </p>
                        {lastMsg && Number.isFinite(lastMsg.createdAtMs) && (
                          <time
                            className={`type-caption shrink-0 tabular-nums ${
                              unread > 0 ? 'font-semibold text-accent' : ''
                            }`}
                            dateTime={new Date(lastMsg.createdAtMs).toISOString()}
                          >
                            {formatClockTime(lastMsg.createdAtMs, locale)}
                          </time>
                        )}
                      </div>
                      {lastMsg ? (
                        <p
                          className={`type-caption mt-0.5 truncate ${
                            unread > 0 ? 'font-medium text-ink/85' : ''
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
                      <span
                        aria-hidden="true"
                        className="type-badge shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-on-accent"
                      >
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </main>
  );
}

export default DmListView;