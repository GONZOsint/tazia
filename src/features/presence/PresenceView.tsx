import { useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw, Users } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { visualFromUserId, type PeerVisual } from '../../core/crypto/identity';
import { useT } from '../../i18n';
import {
  MAX_USERS,
  MESH_SOFT_WARN_PEERS,
  type MeshStatus,
  type PresenceState,
} from '../../core/protocol';
import type { TrustStore } from '../../core/trust/trustStore';
import { PeerAvatar } from '../../components/content/PeerAvatar';
import {
  peerAvatarSeed,
  rememberPeerAvatarSeed,
} from '../../core/avatar/peerSeedCache';
import { MeshStatusBadge } from '../../components/session/MeshStatusBadge';
import { TrustBadge } from '../../components/session/TrustBadge';
import { EmojiVerifyModal } from '../../components/session/EmojiVerifyModal';
import { EmptyZoneCta } from '../../components/ui/AccentButton';
import {
  DUR,
  EASE,
  IGNITE,
  listRowEnter,
  peerMaterialize,
  peerRowExit,
  TAP,
  TAP_TRANSITION,
  zoneBootReduced,
} from '../../motion/tokens';

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
  roomId?: string | null;
  relayActive?: boolean;
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
  roomId = null,
  relayActive = false,
  onSyncNow,
  isSyncing,
  onGoToRooms,
}: PresenceViewProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [visuals, setVisuals] = useState<Record<string, PeerVisual>>({});
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [verifyPeer, setVerifyPeer] = useState<{
    userId: string;
    alias: string;
    keyB64: string;
    encB64: string;
  } | null>(null);
  /** Bump-only: force re-read of trustStore without remounting badges. */
  const [, setTrustTick] = useState(0);
  const [justJoinedIds, setJustJoinedIds] = useState<Set<string>>(() => new Set());
  const prevOnlineRef = useRef<Set<string>>(new Set());
  /** Skip join rituals on first paint — everyone already online isn't "new". */
  const onlineSeededRef = useRef(false);

  /** Zone switch without remount — clear local UI state for the new room. */
  useEffect(() => {
    setOpenDetails({});
    setVerifyPeer(null);
    setJustJoinedIds(new Set());
    setVisuals({});
    prevOnlineRef.current = new Set();
    onlineSeededRef.current = false;
  }, [roomId]);

  useEffect(() => {
    if (!trustStore) return;
    return trustStore.onChange(() => setTrustTick((n) => n + 1));
  }, [trustStore]);

  useEffect(() => {
    for (const [id, state] of Object.entries(presence)) {
      if (state.avatarSeed) rememberPeerAvatarSeed(id, state.avatarSeed);
    }
  }, [presence]);

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

  useEffect(() => {
    const next = new Set(onlineUserIds);
    if (!onlineSeededRef.current) {
      onlineSeededRef.current = true;
      prevOnlineRef.current = next;
      return;
    }
    const prev = prevOnlineRef.current;
    const joined: string[] = [];
    for (const id of next) {
      // Self is always "here" — never play the join bubble on the local user.
      if (!prev.has(id) && id !== selfUserId) joined.push(id);
    }
    prevOnlineRef.current = next;
    if (joined.length === 0) return;
    setJustJoinedIds((cur) => {
      const merged = new Set(cur);
      for (const id of joined) merged.add(id);
      return merged;
    });
    // Cover peer-join-dot (--dur-pulse) + peerMaterialize settle.
    const timer = window.setTimeout(() => {
      setJustJoinedIds((cur) => {
        const cleaned = new Set(cur);
        for (const id of joined) cleaned.delete(id);
        return cleaned;
      });
    }, IGNITE.finishMs);
    return () => window.clearTimeout(timer);
  }, [onlineUserIds, selfUserId]);

  if (!selfUserId) {
    return (
      <EmptyZoneCta
        icon={<Users className="h-12 w-12 text-faint" aria-hidden="true" strokeWidth={1.5} />}
        title={t('presenceEmptyTitle')}
        body={t('presenceEmptyBody')}
        actionLabel={t('presenceEmptyCta')}
        onAction={() => onGoToRooms?.()}
      />
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

  const meshPeers = peerOnlineCount ?? Math.max(0, onlineUserIds.length - 1);

  return (
    <main className="mx-auto max-w-[720px] px-4 py-4 sm:px-8 sm:py-6">
      <header className="border-b border-border pb-3">
        <h1 className="type-headline text-ink">{t('presenceTitle')}</h1>
        <p className="type-caption mt-0.5">{countLabel}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <MeshStatusBadge
            status={meshStatus}
            onlineCount={meshPeers}
            relayActive={relayActive}
          />
          {rejectedSyncCount > 0 && (
            <p className="type-caption">{rejectedLabel}</p>
          )}
          <motion.button
            whileTap={isSyncing ? undefined : TAP}
            transition={TAP_TRANSITION}
            type="button"
            onClick={() => void onSyncNow()}
            disabled={isSyncing}
            className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-ctrl)] border border-border bg-surface-raised px-3 type-ui font-semibold text-ink hover:bg-bg focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {t('presenceRefresh')}
          </motion.button>
        </div>
        {meshPeers >= MESH_SOFT_WARN_PEERS && (
          <p className="type-caption mt-2 text-warn-ink" role="status">
            {t('roomsMeshLargeWarn', { n: meshPeers, max: MAX_USERS })}
          </p>
        )}
      </header>

      <ul className="relative mt-3 space-y-1.5">
        <AnimatePresence mode="popLayout" initial={false}>
        {onlineUserIds.map((id) => {
          const isSelf = id === selfUserId;
          const visual = visuals[id];
          const alias =
            presence[id]?.alias ||
            (isSelf ? t('you') : undefined) ||
            visual?.suggestedAlias ||
            t('presenceNoAlias');
          const hasKey = Boolean(presence[id]?.signPubKeySpkiB64);
          const details = openDetails[id];
          const justJoined = justJoinedIds.has(id);
          const trustLevel =
            !isSelf && trustStore ? (trustStore.get(id)?.level ?? 'new') : undefined;
          const canShowTrust = !isSelf && hasKey && Boolean(selfSignPubKeyB64);
          // Match/SAS only for non-changed peers; `changed` must go through KeyChange/repin first.
          const canOpenVerify = canShowTrust && trustLevel !== 'changed';
          const trustActionLabel =
            trustLevel === 'verified'
              ? t('trustVerified')
              : trustLevel === 'changed'
                ? t('trustChanged')
                : t('trustVerifyTitle');
          return (
            <motion.li
              key={id}
              layout={false}
              initial={
                justJoined
                  ? reduceMotion
                    ? zoneBootReduced.initial
                    : listRowEnter.initial
                  : false
              }
              animate={
                reduceMotion ? zoneBootReduced.animate : listRowEnter.animate
              }
              exit={
                reduceMotion
                  ? { opacity: 0, transition: { duration: DUR.micro, ease: EASE.easeIn } }
                  : peerRowExit
              }
              className="list-row px-3 py-2"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative shrink-0">
                  <motion.div
                    initial={
                      justJoined
                        ? reduceMotion
                          ? zoneBootReduced.initial
                          : peerMaterialize.initial
                        : false
                    }
                    animate={
                      reduceMotion
                        ? zoneBootReduced.animate
                        : peerMaterialize.animate
                    }
                  >
                    <PeerAvatar
                      avatarSeed={presence[id]?.avatarSeed || peerAvatarSeed(id)}
                      matrix={visual?.identiconMatrix}
                      size={28}
                      label={alias}
                      fg={visual?.fg}
                      bg={visual?.bg}
                    />
                  </motion.div>
                  {justJoined && (
                    <span
                      className="peer-join-dot absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="type-ui truncate font-semibold leading-tight text-ink">
                    {alias}
                    {isSelf ? t('presenceYou') : ''}
                  </p>
                  {!hasKey && !isSelf && (
                    <p className="type-caption mt-0.5 leading-tight text-warn">{t('presenceNoKey')}</p>
                  )}
                </div>
                {canShowTrust && trustLevel && (
                  <motion.button
                    whileTap={canOpenVerify ? TAP : undefined}
                    transition={TAP_TRANSITION}
                    type="button"
                    disabled={!canOpenVerify}
                    onClick={() => {
                      if (!canOpenVerify) return;
                      const pinned =
                        trustStore?.get(id)?.pinnedKeyB64 ?? presence[id]?.signPubKeySpkiB64;
                      if (!pinned) return;
                      const enc =
                        trustStore?.getPinnedEnc(id) ??
                        presence[id]?.encPubKeyRawB64 ??
                        '';
                      setVerifyPeer({
                        userId: id,
                        alias,
                        keyB64: pinned,
                        encB64: enc,
                      });
                    }}
                    className="icon-action icon-action--ghost icon-action--dense shrink-0 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-80"
                    title={trustActionLabel}
                    aria-label={trustActionLabel}
                  >
                    <TrustBadge level={trustLevel} />
                  </motion.button>
                )}
                <motion.button
                  whileTap={TAP}
                  transition={TAP_TRANSITION}
                  type="button"
                  aria-expanded={!!details}
                  onClick={() =>
                    setOpenDetails((prev) => ({ ...prev, [id]: !prev[id] }))
                  }
                  className="type-caption inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-ctrl)] px-2 py-1.5 font-medium hover:bg-bg hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {/* Stable label width — swapping to "Ocultar" used to shove the trust badge. */}
                  {t('presenceDetails')}
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 transition-transform duration-[var(--dur-micro)] ${
                      details ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </motion.button>
              </div>
              <div
                className={`grid transition-[grid-template-rows] duration-[var(--dur-micro)] ease-[var(--ease-out-expo)] ${
                  details ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="mt-2 space-y-1 rounded-[var(--radius-ctrl)] border border-border bg-bg px-3 py-2">
                    <p className="type-label uppercase text-faint">
                      {t('presenceDetails')}
                    </p>
                    {hasKey && (
                      <p className="type-caption font-mono">
                        {t('presenceKeyShort', {
                          fp: shortKeyFp(presence[id].signPubKeySpkiB64),
                        })}
                      </p>
                    )}
                    <p className="type-caption break-all font-mono">
                      {t('presencePeerId', { id })}
                    </p>
                  </div>
                </div>
              </div>
            </motion.li>
          );
        })}
        </AnimatePresence>
      </ul>

      {verifyPeer && selfSignPubKeyB64 && (
        <EmojiVerifyModal
          open={!!verifyPeer}
          peerAlias={verifyPeer.alias}
          selfKeyB64={selfSignPubKeyB64}
          peerKeyB64={verifyPeer.keyB64}
          selfEncB64={
            (selfUserId &&
              (trustStore?.getPinnedEnc(selfUserId) ??
                presence[selfUserId]?.encPubKeyRawB64)) ||
            ''
          }
          peerEncB64={verifyPeer.encB64}
          roomId={roomId ?? ''}
          onVerify={() => {
            trustStore?.verify(verifyPeer.userId);
            setTrustTick((n) => n + 1);
            setVerifyPeer(null);
          }}
          onClose={() => setVerifyPeer(null)}
        />
      )}
    </main>
  );
}

export default PresenceView;
