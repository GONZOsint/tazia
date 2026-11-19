import { ChevronRight, KeyRound, LogOut, PlusCircle, QrCode } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { MutableRefObject } from 'react';
import { identiconVisualFromHex } from '../../../core/crypto/identity';
import {
  countOtherPeers,
  MAX_ROOMS,
  type RoomState,
} from '../../../hooks/useRoomManager';
import { useT } from '../../../i18n';
import { Identicon } from '../../../components/content/Identicon';
import { AccentButton, SecondaryButton } from '../../../components/ui/AccentButton';
import { ConfettiBurst } from '../../../components/ui/ConfettiBurst';
import { MeshStatusBadge } from '../../../components/session/MeshStatusBadge';
import { RegionAshOverlay } from '../../../components/session/RegionAshOverlay';
import {
  DUR,
  EASE,
  IGNITE,
  forgeEnter,
  listRowEnter,
  zoneCardExit,
  zoneListLayout,
} from '../../../motion/tokens';
import { haptic, HAPTIC_TAP } from '../../../motion/haptic';
import { ZoneInvitePanel } from '../ZoneInvitePanel';
import { CapacityDots } from './CapacityDots';

type JoinedZonesSectionProps = {
  listRooms: RoomState[];
  joinedRooms: RoomState[];
  activeRoomId: string | null;
  leavingId: string | null;
  ashRoom: RoomState | null;
  reduceMotion: boolean | null;
  atCap: boolean;
  browserBlocked: boolean;
  forgeConfetti: boolean;
  setForgeConfetti: (v: boolean) => void;
  pulseRoomId: string | null;
  qrRoomId: string | null;
  setQrRoomId: (updater: (cur: string | null) => string | null) => void;
  seenRoomIdsRef: MutableRefObject<Set<string>>;
  onLeaveRoom?: (roomId: string) => Promise<void>;
  onSwitchRoom?: (roomId: string) => void;
  setLeaveTarget: (id: string | null) => void;
  clearZoneAsh: () => void;
  onExitComplete: () => void;
  openEntry: (tab: 'create' | 'join') => void;
};

export function JoinedZonesSection({
  listRooms,
  joinedRooms,
  activeRoomId,
  leavingId,
  ashRoom,
  reduceMotion,
  atCap,
  browserBlocked,
  forgeConfetti,
  setForgeConfetti,
  pulseRoomId,
  qrRoomId,
  setQrRoomId,
  seenRoomIdsRef,
  onLeaveRoom,
  onSwitchRoom,
  setLeaveTarget,
  clearZoneAsh,
  onExitComplete,
  openEntry,
}: JoinedZonesSectionProps) {
  const t = useT();

  return (
    <section className="panel-surface panel-pad" aria-labelledby="rooms-joined-title">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="rooms-joined-title" className="type-title text-ink">
            {t('roomsJoinedTitle')}
          </h2>
          {listRooms.length < MAX_ROOMS && (
            <p className="type-caption mt-0.5">{t('roomsActiveHint')}</p>
          )}
        </div>
        <CapacityDots
          filled={joinedRooms.length}
          max={MAX_ROOMS}
          label={t('roomsCapacityAria', {
            n: joinedRooms.length,
            max: MAX_ROOMS,
          })}
        />
      </div>

      <ul className="relative mt-3 flex flex-col gap-2">
        <ConfettiBurst play={forgeConfetti} onDone={() => setForgeConfetti(false)} />
        <RegionAshOverlay
          play={Boolean(ashRoom) && !reduceMotion}
          mode="burn"
          collapseDom={false}
          canvasId="zone-ash-fire-canvas"
          selectors={
            ashRoom
              ? [`.zone-ash-target[data-zone-card="${CSS.escape(ashRoom.roomId)}"]`]
              : []
          }
          maxEdgePx={[420]}
          onComplete={clearZoneAsh}
        />
        <AnimatePresence mode="popLayout" initial={false} onExitComplete={onExitComplete}>
          {listRooms.map((room) => {
            const isActive = room.roomId === activeRoomId;
            const dmUnread = Object.values(room.dmUnread).reduce((a, b) => a + b, 0);
            const showQr = qrRoomId === room.roomId;
            const justBorn = !seenRoomIdsRef.current.has(room.roomId);
            const justJoined = pulseRoomId === room.roomId || justBorn;
            const ashing = ashRoom?.roomId === room.roomId;
            const enter = justBorn && !reduceMotion ? forgeEnter : listRowEnter;
            const zoneIcon = identiconVisualFromHex(room.roomId);
            return (
              <motion.li
                key={room.roomId}
                layout={ashRoom || reduceMotion ? false : 'position'}
                layoutDependency={leavingId ?? listRooms.length}
                initial={enter.initial}
                animate={enter.animate}
                exit={
                  ashing
                    ? { opacity: 0, transition: { duration: 0 } }
                    : reduceMotion
                      ? zoneCardExit.exitReduced
                      : zoneCardExit.exit
                }
                transition={{
                  layout: reduceMotion
                    ? { duration: DUR.micro, ease: EASE.outExpo }
                    : zoneListLayout,
                }}
                data-zone-id={room.roomId}
                data-zone-card={room.roomId}
                className={`session-burn-target session-ignite-target relative overflow-hidden rounded-[var(--radius-ctrl)] border ${
                  ashing ? 'zone-ash-target ' : ''
                }${
                  isActive
                    ? 'border-accent bg-accent-soft ring-1 ring-accent/50'
                    : 'border-border bg-bg'
                } ${justJoined ? 'zone-join-pulse igniting-front' : ''} ${
                  room.relayFallbackActive ? 'relay-channel-tint' : ''
                }`}
                aria-current={isActive ? 'true' : undefined}
                aria-busy={ashing ? true : undefined}
              >
                {/*
                  Own layoutId only while pulseRoomId matches — survives the
                  seenRoomIdsRef update that clears justBorn before paint.
                  CTA spark unmounts in the same batch → single morph owner.
                */}
                {pulseRoomId === room.roomId && !reduceMotion && (
                  <motion.span
                    layoutId={IGNITE.layoutId}
                    className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-accent/30"
                    transition={EASE.ritualSpring}
                    aria-hidden="true"
                  />
                )}
                <div className="flex items-stretch gap-0">
                  <button
                    type="button"
                    onClick={() => onSwitchRoom?.(room.roomId)}
                    disabled={ashing}
                    className="pressable flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-3.5 disabled:opacity-60"
                    aria-label={
                      isActive
                        ? `${t('roomsGoToChat')}: ${room.roomId}`
                        : `${t('roomsSwitchTo')}: ${room.roomId}`
                    }
                  >
                    <Identicon
                      matrix={zoneIcon.identiconMatrix}
                      size={40}
                      label={room.roomId}
                      fg={zoneIcon.fg}
                      bg={zoneIcon.bg}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[length:var(--type-caption)] font-medium tracking-[0.01em] text-ink">
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
                          <span className="type-badge rounded-full bg-accent px-2 py-0.5 text-on-accent">
                            {t('roomsActiveLabel')}
                          </span>
                        )}
                        {room.unreadCount > 0 && (
                          <span className="type-badge rounded-full bg-accent/90 px-2 py-0.5 text-on-accent">
                            {room.unreadCount > 9 ? '9+' : room.unreadCount}
                          </span>
                        )}
                        {dmUnread > 0 && (
                          <span className="type-badge rounded-full border border-border bg-surface-raised px-2 py-0.5 font-semibold text-muted">
                            {dmUnread > 9 ? '9+' : dmUnread}
                          </span>
                        )}
                      </div>
                      {room.roomError && (
                        <p className="type-caption mt-1 truncate text-danger-ink">
                          {t(room.roomError.key, room.roomError.vars)}
                        </p>
                      )}
                      {!room.roomError &&
                        (room.transportNotice || room.relayFallbackActive) && (
                          <p className="type-caption mt-1 truncate text-warn-ink">
                            {t(
                              room.transportNotice?.key ?? 'infoRelayPath',
                              room.transportNotice?.vars
                            )}
                          </p>
                        )}
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 self-center ${
                        isActive ? 'text-accent' : 'text-faint'
                      }`}
                      aria-hidden="true"
                      strokeWidth={1.75}
                    />
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5 border-l border-border/70 pl-1.5 pr-2">
                    <button
                      type="button"
                      onClick={() => {
                        haptic(HAPTIC_TAP);
                        setQrRoomId((cur) => (cur === room.roomId ? null : room.roomId));
                      }}
                      disabled={ashing}
                      aria-pressed={showQr}
                      className={`icon-action pressable focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50 ${
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
                        disabled={ashing || Boolean(ashRoom)}
                        className="icon-action icon-action--danger pressable focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
                        title={t('roomsLeaveRoom')}
                        aria-label={t('roomsLeaveRoom')}
                      >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
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

      {/* Mobile: one primary path (Abrir) + secondary (Entrar). Desktop uses the side panel. */}
      <div className="mt-4 border-t border-border pt-4 md:hidden">
        <div className="mb-3">
          <h3 className="type-ui font-semibold text-ink">{t('roomsAnotherTitle')}</h3>
          <p className="type-caption mt-0.5">
            {atCap ? t('roomsMaxReached', { n: MAX_ROOMS }) : t('roomsAnotherHint')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <AccentButton
            size="md"
            disabled={atCap || browserBlocked}
            onClick={() => openEntry('create')}
            className="w-full"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            {t('roomsCreate')}
          </AccentButton>
          <SecondaryButton
            size="md"
            disabled={atCap || browserBlocked}
            onClick={() => openEntry('join')}
            className="w-full"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {t('roomsJoin')}
          </SecondaryButton>
        </div>
      </div>
    </section>
  );
}
