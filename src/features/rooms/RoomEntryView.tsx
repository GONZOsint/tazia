import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound, LogOut, PlusCircle, QrCode } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { identiconMatrixFromHex } from '../../core/crypto/identity';
import {
  countOtherPeers,
  MAX_ROOMS,
  type RoomJoinParams,
  type RoomState,
} from '../../hooks/useRoomManager';
import { useT } from '../../i18n';
import { Identicon } from '../../components/content/Identicon';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TaziaLogo } from '../../components/brand/TaziaLogo';
import { MeshStatusBadge } from '../../components/session/MeshStatusBadge';
import { probeBrowserSupportSync } from '../../core/utils/browserSupport';
import { DUR, EASE, TAP, TAP_TRANSITION, zoneCardExit } from '../../motion/tokens';
import { CreateRoomForm } from './CreateRoomForm';
import { JoinRoomForm } from './JoinRoomForm';
import { TurnRelaySettings } from './TurnRelaySettings';
import { ZoneInvitePanel } from './ZoneInvitePanel';

interface RoomEntryViewProps {
  initialRoomId?: string;
  initialPhrase?: string | null;
  isJoining: boolean;
  errorMsg: string | null;
  /** Expand TURN panel (ICE / peer-connect failures). */
  showIceHint?: boolean;
  activeRoomId?: string | null;
  joinedRooms?: RoomState[];
  onJoinRoom: (params: RoomJoinParams) => Promise<void>;
  onSwitchRoom?: (roomId: string) => void;
  onLeaveRoom?: (roomId: string) => Promise<void>;
}

export function RoomEntryView({
  initialRoomId = '',
  initialPhrase = null,
  isJoining,
  errorMsg,
  showIceHint = false,
  activeRoomId = null,
  joinedRooms = [],
  onJoinRoom,
  onSwitchRoom,
  onLeaveRoom,
}: RoomEntryViewProps) {
  const t = useT();
  const hasInvite = Boolean(initialRoomId);
  const hasZones = joinedRooms.length > 0;
  const atCap = joinedRooms.length >= MAX_ROOMS;
  const [entryTab, setEntryTab] = useState<'create' | 'join' | null>(() =>
    hasInvite ? 'join' : hasZones ? null : null
  );
  const [createFormKey, setCreateFormKey] = useState(0);
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const [qrRoomId, setQrRoomId] = useState<string | null>(null);
  const [pulseRoomId, setPulseRoomId] = useState<string | null>(null);
  const prevJoinedIdsRef = useRef<Set<string>>(new Set(joinedRooms.map((r) => r.roomId)));
  const prevJoinedCountRef = useRef(joinedRooms.length);
  const browserSupport = useMemo(() => probeBrowserSupportSync(), []);
  const browserBlocked = browserSupport.level === 'blocked';

  useEffect(() => {
    if (hasInvite) setEntryTab('join');
  }, [hasInvite]);

  useEffect(() => {
    if (showIceHint && hasZones) setEntryTab((cur) => cur ?? 'join');
  }, [showIceHint, hasZones]);

  // After a successful join, collapse the form and mint a fresh create session
  // so "Abrir" cannot reuse the previous zone id while the tab stays mounted.
  useEffect(() => {
    const prev = prevJoinedCountRef.current;
    prevJoinedCountRef.current = joinedRooms.length;
    const prevIds = prevJoinedIdsRef.current;
    const nextIds = new Set(joinedRooms.map((r) => r.roomId));
    let newlyJoined: string | null = null;
    for (const id of nextIds) {
      if (!prevIds.has(id)) {
        newlyJoined = id;
        break;
      }
    }
    prevJoinedIdsRef.current = nextIds;
    if (joinedRooms.length > prev) {
      setEntryTab(null);
      setCreateFormKey((k) => k + 1);
      if (newlyJoined) {
        setPulseRoomId(newlyJoined);
        const t = window.setTimeout(() => setPulseRoomId((cur) => (cur === newlyJoined ? null : cur)), 450);
        return () => window.clearTimeout(t);
      }
    }
  }, [joinedRooms]);

  const openEntry = (tab: 'create' | 'join') => {
    if (atCap) return;
    if (entryTab === tab) {
      setEntryTab(null);
      return;
    }
    if (tab === 'create') setCreateFormKey((k) => k + 1);
    setEntryTab(tab);
  };

  const enterZone = (roomId: string) => {
    onSwitchRoom?.(roomId);
  };

  return (
    <main className="mx-auto max-w-[1280px] space-y-4 px-4 py-3 sm:px-8 sm:py-5 lg:py-6">
      {browserBlocked && (
        <AlertBanner tone="error">
          <p className="font-semibold">{t('browserBlockedTitle')}</p>
          <p className="mt-1 font-normal opacity-90">{t('browserBlockedBody')}</p>
          {!browserSupport.secureContext && (
            <p className="mt-1 font-normal opacity-90">{t('browserHttpsHint')}</p>
          )}
        </AlertBanner>
      )}

      {!hasZones && (
        <section className="panel-surface relative overflow-hidden px-5 py-10 sm:px-10 sm:py-14">
          <div className="hero-glow" aria-hidden="true" />
          <div className="relative mx-auto flex max-w-lg flex-col items-center text-center">
            <TaziaLogo size={72} />
            <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl [text-wrap:balance]">
              {t('brand')}
            </h1>
            <p className="mt-2 text-sm text-muted">{t('roomsHeroTitle')}</p>

            <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              <motion.button
                whileTap={browserBlocked ? undefined : TAP}
                transition={TAP_TRANSITION}
                type="button"
                disabled={browserBlocked}
                onClick={() => openEntry('create')}
                className={`inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${
                  entryTab === 'create'
                    ? 'bg-accent text-on-accent'
                    : 'border border-border bg-bg text-ink hover:border-ink/30 hover:bg-surface'
                }`}
              >
                <PlusCircle className="h-5 w-5" aria-hidden="true" />
                {t('roomsCreate')}
              </motion.button>
              <motion.button
                whileTap={browserBlocked ? undefined : TAP}
                transition={TAP_TRANSITION}
                type="button"
                disabled={browserBlocked}
                onClick={() => openEntry('join')}
                className={`inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${
                  entryTab === 'join'
                    ? 'bg-accent text-on-accent'
                    : 'border border-border bg-bg text-ink hover:border-ink/30 hover:bg-surface'
                }`}
              >
                <KeyRound className="h-5 w-5" aria-hidden="true" />
                {t('roomsJoin')}
              </motion.button>
            </div>
          </div>
        </section>
      )}

      {hasZones && (
        <section className="panel-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                {t('roomsJoinedTitle')}
              </h2>
              {joinedRooms.length < MAX_ROOMS && (
                <p className="mt-0.5 text-xs text-muted">{t('roomsActiveHint')}</p>
              )}
            </div>
            <CapacityDots filled={joinedRooms.length} max={MAX_ROOMS} label={t('roomsCapacityAria', { n: joinedRooms.length, max: MAX_ROOMS })} />
          </div>

          <ul className="relative mt-3 space-y-2">
            <AnimatePresence mode="popLayout" initial={false}>
              {joinedRooms.map((room) => {
                const isActive = room.roomId === activeRoomId;
                const dmUnread = Object.values(room.dmUnread).reduce((a, b) => a + b, 0);
                const showQr = qrRoomId === room.roomId;
                const justJoined = pulseRoomId === room.roomId;
                return (
                  <motion.li
                    key={room.roomId}
                    layout
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { duration: DUR.medium, ease: EASE.outExpo },
                    }}
                    exit={zoneCardExit.exit}
                    data-zone-id={room.roomId}
                    className={`session-burn-target session-ignite-target overflow-hidden rounded-[var(--radius-ctrl)] border ${
                      isActive
                        ? 'border-accent bg-accent-soft ring-1 ring-accent/50'
                        : 'border-border bg-bg'
                    } ${justJoined ? 'zone-join-pulse igniting-front' : ''} ${
                      room.relayFallbackActive ? 'relay-channel-tint' : ''
                    }`}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <div className="flex items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() => enterZone(room.roomId)}
                        className="pressable flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-3.5"
                        aria-label={
                          isActive
                            ? `${t('roomsGoToChat')}: ${room.roomId}`
                            : `${t('roomsSwitchTo')}: ${room.roomId}`
                        }
                      >
                        <Identicon
                          matrix={identiconMatrixFromHex(room.roomId)}
                          size={40}
                          label={room.roomId}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-xs font-medium text-ink">
                            {room.roomId}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <MeshStatusBadge
                              status={room.meshStatus}
                              onlineCount={countOtherPeers(room.onlineUserIds, room.selfUserId)}
                              compact
                              relayActive={room.relayFallbackActive}
                            />
                            {isActive && (
                              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent">
                                {t('roomsActiveLabel')}
                              </span>
                            )}
                            {room.unreadCount > 0 && (
                              <span className="rounded-full bg-accent/90 px-2 py-0.5 text-[10px] font-bold text-on-accent">
                                {room.unreadCount > 9 ? '9+' : room.unreadCount}
                              </span>
                            )}
                            {dmUnread > 0 && (
                              <span className="rounded-full border border-border bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-muted">
                                {dmUnread > 9 ? '9+' : dmUnread}
                              </span>
                            )}
                          </div>
                          {room.roomError && (
                            <p className="mt-1 truncate text-[11px] text-danger-ink">
                              {t(room.roomError.key, room.roomError.vars)}
                            </p>
                          )}
                          {!room.roomError && (room.transportNotice || room.relayFallbackActive) && (
                            <p className="mt-1 truncate text-[11px] text-warn-ink">
                              {t(
                                room.transportNotice?.key ?? 'infoRelayPath',
                                room.transportNotice?.vars
                              )}
                            </p>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrRoomId((cur) => (cur === room.roomId ? null : room.roomId))}
                        aria-pressed={showQr}
                        className={`icon-action pressable shrink-0 self-center focus-visible:outline-2 focus-visible:outline-accent ${
                          showQr ? 'is-active' : 'icon-action--ghost'
                        }`}
                        title={showQr ? t('roomsHideQr') : t('roomsShowQr')}
                        aria-label={showQr ? t('roomsHideQr') : t('roomsShowQr')}
                      >
                        <QrCode className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {onLeaveRoom && (
                        <button
                          type="button"
                          onClick={() => setLeaveTarget(room.roomId)}
                          className="icon-action icon-action--danger pressable shrink-0 self-center focus-visible:outline-2 focus-visible:outline-accent"
                          title={t('roomsLeaveRoom')}
                          aria-label={t('roomsLeaveRoom')}
                        >
                          <LogOut className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <AnimatePresence initial={false}>
                      {showQr && (
                        <ZoneInvitePanel
                          key={`qr-${room.roomId}`}
                          roomId={room.roomId}
                          phrase={room.phrase}
                          compact
                        />
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink">{t('roomsAnotherTitle')}</h3>
              <p className="mt-0.5 text-xs text-muted">
                {atCap ? t('roomsMaxReached', { n: MAX_ROOMS }) : t('roomsAnotherHint')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileTap={atCap || browserBlocked ? undefined : TAP}
                transition={TAP_TRANSITION}
                type="button"
                disabled={atCap || browserBlocked}
                onClick={() => openEntry('create')}
                aria-pressed={entryTab === 'create'}
                className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${
                  entryTab === 'create'
                    ? 'bg-accent text-on-accent'
                    : 'border border-border bg-bg text-ink hover:bg-surface'
                }`}
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                {t('roomsCreate')}
              </motion.button>
              <motion.button
                whileTap={atCap || browserBlocked ? undefined : TAP}
                transition={TAP_TRANSITION}
                type="button"
                disabled={atCap || browserBlocked}
                onClick={() => openEntry('join')}
                aria-pressed={entryTab === 'join'}
                className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${
                  entryTab === 'join'
                    ? 'bg-accent text-on-accent'
                    : 'border border-border bg-bg text-ink hover:bg-surface'
                }`}
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                {t('roomsJoin')}
              </motion.button>
            </div>
          </div>
        </section>
      )}

      <AnimatePresence initial={false}>
        {entryTab && !browserBlocked && (
          <motion.section
            key={`entry-${entryTab}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: DUR.tab, ease: EASE.outExpo }}
            className="panel-surface p-4 sm:p-5"
          >
            {errorMsg && (
              <AlertBanner tone="error" className="mb-4">
                {errorMsg}
              </AlertBanner>
            )}

            {showIceHint && (
              <AlertBanner tone="warning" role="status" className="mb-4">
                {t('errIceHint')}
              </AlertBanner>
            )}

            <AnimatePresence mode="wait">
              {entryTab === 'create' ? (
                <CreateRoomForm
                  key={`create-${createFormKey}`}
                  isJoining={isJoining}
                  onJoinRoom={onJoinRoom}
                />
              ) : (
                <JoinRoomForm
                  key="join"
                  initialRoomId={initialRoomId}
                  initialPhrase={initialPhrase}
                  isJoining={isJoining}
                  onJoinRoom={onJoinRoom}
                />
              )}
            </AnimatePresence>

            <TurnRelaySettings forceOpen={showIceHint} />
          </motion.section>
        )}
      </AnimatePresence>

      {!entryTab && showIceHint && (
        <AlertBanner tone="warning" role="status">
          <button
            type="button"
            className="min-h-[44px] rounded-[var(--radius-ctrl)] text-left underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => setEntryTab('join')}
          >
            {t('errIceHint')}
          </button>
        </AlertBanner>
      )}

      <ConfirmModal
        open={leaveTarget !== null}
        title={t('leaveRoomConfirmTitle')}
        body={t('leaveRoomConfirmBody')}
        confirmLabel={t('leaveRoomConfirmAction')}
        danger
        onCancel={() => setLeaveTarget(null)}
        onConfirm={() => {
          const id = leaveTarget;
          setLeaveTarget(null);
          if (id && onLeaveRoom) void onLeaveRoom(id);
        }}
      />
    </main>
  );
}

function CapacityDots({
  filled,
  max,
  label,
}: {
  filled: number;
  max: number;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-1" role="meter" aria-valuenow={filled} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-2 w-2 rounded-full transition-colors duration-[var(--dur-micro)] ${
            i < filled ? 'bg-accent' : 'bg-border'
          }`}
        />
      ))}
    </div>
  );
}
