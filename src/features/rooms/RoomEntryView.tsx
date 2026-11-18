import { useEffect, useMemo, useState } from 'react';
import { KeyRound, LogOut, PlusCircle } from 'lucide-react';
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
import { EASE, zoneCardExit } from '../../motion/tokens';
import { CreateRoomForm } from './CreateRoomForm';
import { JoinRoomForm } from './JoinRoomForm';
import { TurnRelaySettings } from './TurnRelaySettings';

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
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const browserSupport = useMemo(() => probeBrowserSupportSync(), []);
  const browserBlocked = browserSupport.level === 'blocked';

  useEffect(() => {
    if (hasInvite) setEntryTab('join');
  }, [hasInvite]);

  useEffect(() => {
    if (showIceHint && hasZones) setEntryTab((cur) => cur ?? 'join');
  }, [showIceHint, hasZones]);

  const openEntry = (tab: 'create' | 'join') => {
    if (atCap) return;
    setEntryTab((cur) => (cur === tab ? null : tab));
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
        <section className="relative overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised px-5 py-10 sm:px-10 sm:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,color-mix(in_oklab,var(--color-accent)_18%,transparent),transparent_55%)]"
          />
          <div className="relative mx-auto flex max-w-lg flex-col items-center text-center">
            <TaziaLogo size={72} />
            <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl [text-wrap:balance]">
              {t('brand')}
            </h1>
            <p className="mt-2 text-sm text-muted">{t('roomsHeroTitle')}</p>

            <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                disabled={browserBlocked}
                onClick={() => openEntry('create')}
                className={`inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  entryTab === 'create'
                    ? 'bg-accent text-on-accent'
                    : 'border border-border bg-bg text-ink'
                }`}
              >
                <PlusCircle className="h-5 w-5" aria-hidden="true" />
                {t('roomsCreate')}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                disabled={browserBlocked}
                onClick={() => openEntry('join')}
                className={`inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  entryTab === 'join'
                    ? 'bg-accent text-on-accent'
                    : 'border border-border bg-bg text-ink'
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
        <section className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
              {t('roomsJoinedTitle')}
            </h2>
            <CapacityDots filled={joinedRooms.length} max={MAX_ROOMS} label={t('roomsCapacityAria', { n: joinedRooms.length, max: MAX_ROOMS })} />
          </div>

          <ul className="mt-3 space-y-2">
            <AnimatePresence initial={false}>
              {joinedRooms.map((room) => {
                const isActive = room.roomId === activeRoomId;
                const dmUnread = Object.values(room.dmUnread).reduce((a, b) => a + b, 0);
                return (
                  <motion.li
                    key={room.roomId}
                    layout
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={zoneCardExit.exit}
                    transition={{ duration: 0.22, ease: EASE.outExpo }}
                    className={`session-burn-target flex items-stretch gap-1 overflow-hidden rounded-[var(--radius-ctrl)] border ${
                      isActive
                        ? 'border-2 border-accent bg-accent-soft'
                        : 'border-border bg-bg'
                    }`}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => enterZone(room.roomId)}
                      className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-3.5"
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
                        {!room.roomError && room.transportNotice && (
                          <p className="mt-1 truncate text-[11px] text-warn-ink">
                            {t(room.transportNotice.key, room.transportNotice.vars)}
                          </p>
                        )}
                      </div>
                    </button>
                    {onLeaveRoom && (
                      <button
                        type="button"
                        onClick={() => setLeaveTarget(room.roomId)}
                        className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center self-center rounded-[var(--radius-ctrl)] border border-transparent text-danger-ink hover:border-danger-border hover:bg-danger-bg focus-visible:outline-2 focus-visible:outline-accent"
                        title={t('roomsLeaveRoom')}
                        aria-label={t('roomsLeaveRoom')}
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <motion.button
              whileTap={{ scale: atCap ? 1 : 0.98 }}
              type="button"
              disabled={atCap || browserBlocked}
              onClick={() => openEntry('create')}
              aria-pressed={entryTab === 'create'}
              className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${
                entryTab === 'create'
                  ? 'bg-accent text-on-accent'
                  : 'border border-border bg-bg text-ink'
              }`}
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              {t('roomsCreate')}
            </motion.button>
            <motion.button
              whileTap={{ scale: atCap ? 1 : 0.98 }}
              type="button"
              disabled={atCap || browserBlocked}
              onClick={() => openEntry('join')}
              aria-pressed={entryTab === 'join'}
              className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${
                entryTab === 'join'
                  ? 'bg-accent text-on-accent'
                  : 'border border-border bg-bg text-ink'
              }`}
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              {t('roomsJoin')}
            </motion.button>
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
            transition={{ duration: 0.18 }}
            className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-4 sm:p-5"
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
                <CreateRoomForm key="create" isJoining={isJoining} onJoinRoom={onJoinRoom} />
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
            className="underline-offset-2 hover:underline"
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
          className={`h-2 w-2 rounded-full ${
            i < filled ? 'bg-accent' : 'bg-border'
          }`}
        />
      ))}
    </div>
  );
}
