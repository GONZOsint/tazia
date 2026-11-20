import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { applyTrustSasConfirm } from '../../core/trust/trustResolve';
import {
  peerVerifyKeysMatch,
  pickPeerVerifyKeys,
} from '../../core/trust/pickPeerVerifyKeys';
import { PeerAvatar } from '../../components/content/PeerAvatar';
import {
  resolvePeerAvatarSeed,
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

export interface PresenceViewProps {
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
  /** After SAS confirm that repins — refresh VerifyKey + clear key-change alert. */
  onPeerTrustResolved?: (userId: string) => void;
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
  onPeerTrustResolved,
}: PresenceViewProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const listId = useId();

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
  const joinTimersRef = useRef<Map<string, number>>(new Map());

  const uniqueOnlineIds = useMemo(() => Array.from(new Set(onlineUserIds)), [onlineUserIds]);

  // Zone switch without remount — reset local UI before paint (no render-phase setState).
  useLayoutEffect(() => {
    setOpenDetails({});
    setVerifyPeer(null);
    setJustJoinedIds(new Set());
    onlineSeededRef.current = false;
    prevOnlineRef.current = new Set();
    for (const timer of joinTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    joinTimersRef.current.clear();
  }, [roomId]);

  // Close verification modal if the peer went offline mid-flow.
  // Keep open when level is `changed` — SAS + repin is the recovery path.
  useEffect(() => {
    if (!verifyPeer) return;
    const stillOnline = uniqueOnlineIds.includes(verifyPeer.userId);
    if (stillOnline) return;
    const level = trustStore?.getLevel(verifyPeer.userId);
    if (level !== 'changed') setVerifyPeer(null);
  }, [verifyPeer, uniqueOnlineIds, trustStore]);

  useEffect(() => {
    const timers = joinTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (!trustStore) return;
    return trustStore.onChange(() => setTrustTick((n) => n + 1));
  }, [trustStore]);

  // Keep SAS snapshot aligned with live keys while the modal is open.
  useEffect(() => {
    if (!verifyPeer) return;
    const syncKeys = () => {
      const live = pickPeerVerifyKeys(trustStore, presence, verifyPeer.userId);
      if (!live) {
        setVerifyPeer(null);
        return;
      }
      if (!peerVerifyKeysMatch(verifyPeer, live)) {
        setVerifyPeer((prev) =>
          prev && prev.userId === verifyPeer.userId
            ? { ...prev, keyB64: live.keyB64, encB64: live.encB64 }
            : prev
        );
      }
    };
    syncKeys();
    if (!trustStore) return;
    return trustStore.onChange(syncKeys);
  }, [verifyPeer, trustStore, presence]);

  useEffect(() => {
    for (const [id, state] of Object.entries(presence)) {
      if (state.avatarSeed) rememberPeerAvatarSeed(id, state.avatarSeed);
    }
  }, [presence]);

  const missingKey = useMemo(
    () => uniqueOnlineIds.filter((id) => !visuals[id]).join('|'),
    [uniqueOnlineIds, visuals],
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
    const next = new Set(uniqueOnlineIds);
    if (!onlineSeededRef.current) {
      onlineSeededRef.current = true;
      prevOnlineRef.current = next;
      return;
    }

    const prev = prevOnlineRef.current;
    prevOnlineRef.current = next;

    let hasDeparted = false;
    for (const id of prev) {
      if (!next.has(id)) {
        hasDeparted = true;
        const timer = joinTimersRef.current.get(id);
        if (timer) {
          window.clearTimeout(timer);
          joinTimersRef.current.delete(id);
        }
      }
    }

    const joined: string[] = [];
    for (const id of next) {
      // Self is always "here" — never play the join bubble on the local user.
      if (!prev.has(id) && id !== selfUserId) joined.push(id);
    }

    if (joined.length === 0 && !hasDeparted) return;

    setJustJoinedIds((cur) => {
      let changed = false;
      const updated = new Set(cur);
      for (const id of cur) {
        if (!next.has(id)) {
          updated.delete(id);
          changed = true;
        }
      }
      for (const id of joined) {
        if (!updated.has(id)) {
          updated.add(id);
          changed = true;
        }
      }
      return changed ? updated : cur;
    });

    for (const id of joined) {
      const existing = joinTimersRef.current.get(id);
      if (existing) window.clearTimeout(existing);
      // Cover peer-join-dot (--dur-pulse) + peerMaterialize settle per peer.
      const timer = window.setTimeout(() => {
        joinTimersRef.current.delete(id);
        setJustJoinedIds((cur) => {
          if (!cur.has(id)) return cur;
          const cleaned = new Set(cur);
          cleaned.delete(id);
          return cleaned;
        });
      }, IGNITE.finishMs);
      joinTimersRef.current.set(id, timer);
    }
  }, [uniqueOnlineIds, selfUserId]);

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
    uniqueOnlineIds.length === 1
      ? t('presenceCount', { n: uniqueOnlineIds.length })
      : t('presenceCountPlural', { n: uniqueOnlineIds.length });

  const rejectedLabel =
    rejectedSyncCount === 1
      ? t('presenceRejected', { n: rejectedSyncCount })
      : t('presenceRejectedPlural', { n: rejectedSyncCount });

  const meshPeers = peerOnlineCount ?? Math.max(0, uniqueOnlineIds.length - 1);

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
          {rejectedSyncCount > 0 && <p className="type-caption">{rejectedLabel}</p>}
          <motion.button
            whileTap={isSyncing || reduceMotion ? undefined : TAP}
            transition={TAP_TRANSITION}
            type="button"
            onClick={() => void onSyncNow()}
            disabled={isSyncing}
            className="ml-auto inline-flex min-h-[44px] cursor-pointer select-none items-center gap-1.5 rounded-[var(--radius-ctrl)] border border-border bg-surface-raised px-3 type-ui font-semibold text-ink transition-colors hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 shrink-0 ${isSyncing ? 'motion-safe:animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{t('presenceRefresh')}</span>
          </motion.button>
        </div>
        {meshPeers >= MESH_SOFT_WARN_PEERS && (
          <p className="type-caption mt-2 text-warn-ink" role="status">
            {t('roomsMeshLargeWarn', { n: meshPeers, max: MAX_USERS })}
          </p>
        )}
      </header>

      <ul className="relative mt-3 space-y-1.5">
        <AnimatePresence mode="sync" initial={false}>
          {uniqueOnlineIds.map((id) => {
            const isSelf = id === selfUserId;
            const peerPresence = presence[id];
            const visual = visuals[id];
            const alias =
              peerPresence?.alias ||
              (isSelf ? t('you') : undefined) ||
              visual?.suggestedAlias ||
              t('presenceNoAlias');
            const keyB64 = peerPresence?.signPubKeySpkiB64 ?? '';
            const hasKey = Boolean(keyB64);
            const details = Boolean(openDetails[id]);
            const detailsId = `${listId}-details-${id}`;
            const justJoined = justJoinedIds.has(id);
            const trustLevel =
              !isSelf && trustStore ? (trustStore.get(id)?.level ?? 'new') : undefined;
            const canShowTrust = !isSelf && hasKey && Boolean(selfSignPubKeyB64);
            // Allow SAS/verify even when `changed` so dismiss of KeyChangeAlert is not a dead end.
            const canOpenVerify = canShowTrust;
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
                animate={reduceMotion ? zoneBootReduced.animate : listRowEnter.animate}
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
                        reduceMotion ? zoneBootReduced.animate : peerMaterialize.animate
                      }
                    >
                      <PeerAvatar
                        avatarSeed={resolvePeerAvatarSeed(peerPresence?.avatarSeed, id)}
                        matrix={visual?.identiconMatrix}
                        size={isSelf ? 36 : 28}
                        label={alias}
                        fg={visual?.fg}
                        bg={visual?.bg}
                        animated={false}
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
                      <p className="type-caption mt-0.5 leading-tight text-warn">
                        {t('presenceNoKey')}
                      </p>
                    )}
                  </div>
                  {canShowTrust && trustLevel && (
                    <motion.button
                      whileTap={canOpenVerify && !reduceMotion ? TAP : undefined}
                      transition={TAP_TRANSITION}
                      type="button"
                      disabled={!canOpenVerify}
                      onClick={() => {
                        if (!canOpenVerify) return;
                        const keys = pickPeerVerifyKeys(trustStore, presence, id);
                        if (!keys) return;
                        setVerifyPeer({
                          userId: id,
                          alias,
                          keyB64: keys.keyB64,
                          encB64: keys.encB64,
                        });
                      }}
                      className="icon-action icon-action--ghost icon-action--dense shrink-0 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-80"
                      title={trustActionLabel}
                      aria-label={trustActionLabel}
                    >
                      <TrustBadge level={trustLevel} />
                    </motion.button>
                  )}
                  <motion.button
                    whileTap={reduceMotion ? undefined : TAP}
                    transition={TAP_TRANSITION}
                    type="button"
                    aria-expanded={details}
                    aria-controls={detailsId}
                    onClick={() =>
                      setOpenDetails((prev) => ({ ...prev, [id]: !prev[id] }))
                    }
                    className="type-caption inline-flex shrink-0 cursor-pointer select-none items-center gap-1 rounded-[var(--radius-ctrl)] px-2 py-1.5 font-medium transition-colors hover:bg-bg hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {/* Stable label width — swapping to "Ocultar" used to shove the trust badge. */}
                    <span>{t('presenceDetails')}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-[var(--dur-micro)] ${
                        details ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </motion.button>
                </div>
                <div
                  id={detailsId}
                  aria-hidden={!details}
                  inert={!details}
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
                            fp: shortKeyFp(keyB64),
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
            const snapshot = verifyPeer;
            const uid = snapshot.userId;
            if (!trustStore) {
              setVerifyPeer(null);
              return false;
            }
            const live = pickPeerVerifyKeys(trustStore, presence, uid);
            if (!peerVerifyKeysMatch(snapshot, live)) {
              if (live) {
                setVerifyPeer({ ...snapshot, keyB64: live.keyB64, encB64: live.encB64 });
              } else {
                setVerifyPeer(null);
              }
              return false;
            }
            const result = applyTrustSasConfirm(trustStore, uid);
            if (result === 'noop') return false;
            // Dismiss alert + refresh crypto for any successful SAS confirm (incl. plain verified).
            onPeerTrustResolved?.(uid);
            setTrustTick((n) => n + 1);
            return true;
          }}
          onClose={() => setVerifyPeer(null)}
        />
      )}
    </main>
  );
}

export default PresenceView;