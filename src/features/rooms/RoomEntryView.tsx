import { useMemo, useState } from 'react';
import {
  Flame,
  KeyRound,
  LogOut,
  MessageSquare,
  PlusCircle,
  QrCode,
  Radio,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { identiconMatrixFromHex } from '../../core/crypto/identity';
import {
  countOtherPeers,
  type RoomJoinParams,
  type RoomState,
} from '../../hooks/useRoomManager';
import { useT } from '../../i18n';
import { Identicon } from '../../components/content/Identicon';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Card } from '../../components/ui/Card';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TaziaLogo } from '../../components/brand/TaziaLogo';
import { MeshStatusBadge } from '../../components/session/MeshStatusBadge';
import { probeBrowserSupportSync } from '../../core/utils/browserSupport';
import { EASE, zoneCardExit } from '../../motion/tokens';
import { CreateRoomForm } from './CreateRoomForm';
import { JoinRoomForm } from './JoinRoomForm';
import { TurnRelaySettings } from './TurnRelaySettings';

const ZONE_STEPS = [
  { Icon: KeyRound, labelKey: 'roomsPhraseLabel' as const },
  { Icon: QrCode, labelKey: 'roomsInviteTitle' as const },
  { Icon: Radio, labelKey: 'roomsJoin' as const },
  { Icon: Flame, labelKey: 'leaveTab' as const },
] as const;

interface RoomEntryViewProps {
  initialRoomId?: string;
  initialPhrase?: string | null;
  isJoining: boolean;
  errorMsg: string | null;
  /** Expand TURN panel (ICE / peer-connect failures). */
  showIceHint?: boolean;
  activeRoomId?: string | null;
  joinedRooms?: RoomState[];
  onGoToForum?: () => void;
  onGoToHelp?: () => void;
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
  onGoToForum,
  onGoToHelp,
  onJoinRoom,
  onSwitchRoom,
  onLeaveRoom,
}: RoomEntryViewProps) {
  const t = useT();
  const hasInvite = Boolean(initialRoomId);
  const [entryTab, setEntryTab] = useState<'create' | 'join'>(hasInvite ? 'join' : 'create');
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const browserSupport = useMemo(() => probeBrowserSupportSync(), []);
  const browserBlocked = browserSupport.level === 'blocked';
  const activeStep = activeRoomId ? 3 : entryTab === 'create' ? 0 : 1;

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-3 sm:px-8 sm:py-5 lg:py-6">
      {browserBlocked && (
        <AlertBanner tone="error" className="mb-3">
          <p className="font-semibold">{t('browserBlockedTitle')}</p>
          <p className="mt-1 font-normal opacity-90">{t('browserBlockedBody')}</p>
          {!browserSupport.secureContext && (
            <p className="mt-1 font-normal opacity-90">{t('browserHttpsHint')}</p>
          )}
        </AlertBanner>
      )}
      {joinedRooms.length > 0 && (
        <div className="mb-3 space-y-2">
          <h2 className="text-xs font-semibold text-muted">{t('roomsJoinedTitle')}</h2>
          <AnimatePresence initial={false}>
          {joinedRooms.map((room) => {
            const isActive = room.roomId === activeRoomId;
            const dmUnread = Object.values(room.dmUnread).reduce((a, b) => a + b, 0);
            return (
              <motion.div
                key={room.roomId}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={zoneCardExit.exit}
                transition={{ duration: 0.22, ease: EASE.outExpo }}
                className={`flex items-center gap-3 overflow-hidden rounded-[var(--radius-ctrl)] border p-2.5 sm:p-3 ${
                  isActive
                    ? 'border-2 border-accent bg-accent-soft/10'
                    : 'border border-border bg-surface-raised'
                }`}
                aria-current={isActive ? 'true' : undefined}
              >
                <Identicon
                  matrix={identiconMatrixFromHex(room.roomId)}
                  size={36}
                  label={room.roomId}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[11px] text-faint">{room.roomId}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <MeshStatusBadge
                      status={room.meshStatus}
                      onlineCount={countOtherPeers(room.onlineUserIds, room.selfUserId)}
                      compact
                    />
                    {room.unreadCount > 0 && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent">
                        {room.unreadCount > 9 ? '9+' : room.unreadCount}
                      </span>
                    )}
                    {dmUnread > 0 && (
                      <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] font-semibold text-muted">
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
                <div className="flex gap-2">
                  {!isActive && onSwitchRoom && (
                    <button
                      type="button"
                      onClick={() => onSwitchRoom(room.roomId)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-ctrl)] border border-border bg-bg px-3 py-1 text-xs font-semibold text-ink focus-visible:outline-2 focus-visible:outline-accent"
                      title={t('roomsSwitchTo')}
                      aria-label={t('roomsSwitchTo')}
                    >
                      <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">{t('roomsSwitchTo')}</span>
                    </button>
                  )}
                  {isActive && onGoToForum && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={onGoToForum}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-ctrl)] border border-border bg-bg px-3 py-1 text-xs font-semibold text-ink focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('roomsGoToChat')}
                    </motion.button>
                  )}
                  {onLeaveRoom && (
                    <button
                      type="button"
                      onClick={() => setLeaveTarget(room.roomId)}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-ctrl)] border border-danger-border bg-danger-bg px-3 py-1 text-xs font-semibold text-danger-ink focus-visible:outline-2 focus-visible:outline-accent"
                      title={t('roomsLeaveRoom')}
                      aria-label={t('roomsLeaveRoom')}
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
          </AnimatePresence>
        </div>
      )}

      <Card padded={false}>
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <TaziaLogo size={48} className="hidden sm:block" />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px] [text-wrap:balance]">
                {t('roomsHeroTitle')}
              </h1>
              <p className="mt-1 text-sm text-muted">{t('roomsHeroBody')}</p>
            </div>
          </div>

          {onGoToHelp && (
            <button
              type="button"
              onClick={onGoToHelp}
              className="mt-3 text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {t('roomsHowLink')}
            </button>
          )}

          <ol
            className="mt-4 flex items-center justify-between gap-1"
            aria-label={t('roomsHowTitle')}
          >
            {ZONE_STEPS.map(({ Icon, labelKey }, i) => {
              const done = i < activeStep;
              const current = i === activeStep;
              return (
                <li key={labelKey} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${
                      current
                        ? 'border-accent bg-accent text-on-accent'
                        : done
                          ? 'border-ok-border bg-ok-bg text-ok-ink'
                          : 'border-border bg-surface text-faint'
                    }`}
                    title={t(labelKey)}
                    aria-current={current ? 'step' : undefined}
                    aria-label={t(labelKey)}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
                  </span>
                </li>
              );
            })}
          </ol>

          <div
            role="tablist"
            aria-label={t('navRooms')}
            className="relative mt-4 grid grid-cols-2 gap-1 rounded-[var(--radius-ctrl)] bg-surface p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={entryTab === 'create'}
              onClick={() => setEntryTab('create')}
              className={`relative z-10 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-accent ${
                entryTab === 'create' ? 'text-ink' : 'text-muted'
              }`}
            >
              {entryTab === 'create' && (
                <motion.span
                  layoutId="zones-entry-tab"
                  className="absolute inset-0 rounded-lg bg-surface-raised shadow-xs"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <PlusCircle className="relative h-3.5 w-3.5" aria-hidden="true" />
              <span className="relative">{t('roomsCreate')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={entryTab === 'join'}
              onClick={() => setEntryTab('join')}
              className={`relative z-10 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-accent ${
                entryTab === 'join' ? 'text-ink' : 'text-muted'
              }`}
            >
              {entryTab === 'join' && (
                <motion.span
                  layoutId="zones-entry-tab"
                  className="absolute inset-0 rounded-lg bg-surface-raised shadow-xs"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <KeyRound className="relative h-3.5 w-3.5" aria-hidden="true" />
              <span className="relative">{t('roomsJoin')}</span>
            </button>
          </div>

          {errorMsg && (
            <AlertBanner tone="error" className="mt-5">
              {errorMsg}
            </AlertBanner>
          )}

          {showIceHint && (
            <AlertBanner tone="warning" role="status" className="mt-4">
              {t('errIceHint')}
            </AlertBanner>
          )}

          {!browserBlocked && (
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
          )}

          {!browserBlocked && <TurnRelaySettings forceOpen={showIceHint} />}
        </div>
      </Card>

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
