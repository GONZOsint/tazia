import { useState } from 'react';
import { KeyRound, LogOut, PlusCircle, Radio } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import type { RoomJoinParams, RoomState } from '../../hooks/useRoomManager';
import { useT } from '../../i18n';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Card } from '../../components/ui/Card';
import { MeshStatusBadge } from '../../components/session/MeshStatusBadge';
import { CreateRoomForm } from './CreateRoomForm';
import { JoinRoomForm } from './JoinRoomForm';
import { RoomHowSteps } from './RoomHowAside';
import { TurnRelaySettings } from './TurnRelaySettings';

interface RoomEntryViewProps {
  initialRoomId?: string;
  initialPhrase?: string | null;
  phraseWasScrubbed?: boolean;
  isJoining: boolean;
  errorMsg: string | null;
  /** Expand TURN panel (ICE / peer-connect failures). */
  showIceHint?: boolean;
  activeRoomId?: string | null;
  joinedRooms?: RoomState[];
  onGoToForum?: () => void;
  onJoinRoom: (params: RoomJoinParams) => Promise<void>;
  onSwitchRoom?: (roomId: string) => void;
  onLeaveRoom?: (roomId: string) => Promise<void>;
}

export function RoomEntryView({
  initialRoomId = '',
  initialPhrase = null,
  phraseWasScrubbed = false,
  isJoining,
  errorMsg,
  showIceHint = false,
  activeRoomId = null,
  joinedRooms = [],
  onGoToForum,
  onJoinRoom,
  onSwitchRoom,
  onLeaveRoom,
}: RoomEntryViewProps) {
  const t = useT();
  const hasInvite = Boolean(initialRoomId);
  const [entryTab, setEntryTab] = useState<'create' | 'join'>(hasInvite ? 'join' : 'create');

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8 lg:py-10">
      {joinedRooms.length > 0 && (
        <div className="mb-6 space-y-2">
          <h2 className="text-xs font-semibold text-muted">{t('roomsJoinedTitle')}</h2>
          {joinedRooms.map((room) => {
            const isActive = room.roomId === activeRoomId;
            return (
              <div
                key={room.roomId}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  isActive
                    ? 'border-accent/40 bg-accent-soft/10'
                    : 'border-border bg-surface-raised'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-ink">
                    {room.roomId}
                    {isActive && (
                      <span className="ml-2 text-[10px] font-semibold text-accent">
                        {t('roomsActiveLabel')}
                      </span>
                    )}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <MeshStatusBadge
                      status={room.meshStatus}
                      onlineCount={room.onlineUserIds.length}
                    />
                    {room.unreadCount > 0 && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent">
                        {t('roomsUnread', { n: room.unreadCount })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!isActive && onSwitchRoom && (
                    <button
                      type="button"
                      onClick={() => onSwitchRoom(room.roomId)}
                      className="min-h-[36px] rounded-lg border border-border bg-bg px-3 py-1 text-xs font-semibold text-ink focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                  {isActive && onGoToForum && (
                    <button
                      type="button"
                      onClick={onGoToForum}
                      className="min-h-[36px] rounded-lg border border-border bg-bg px-3 py-1 text-xs font-semibold text-ink focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {t('roomsSwitchTo')}
                    </button>
                  )}
                  {onLeaveRoom && (
                    <button
                      type="button"
                      onClick={() => void onLeaveRoom(room.roomId)}
                      className="min-h-[36px] rounded-lg border border-danger-border bg-danger-bg px-3 py-1 text-xs font-semibold text-danger-ink focus-visible:outline-2 focus-visible:outline-accent"
                      title={t('roomsLeaveRoom')}
                    >
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-6">
        <RoomHowSteps />
      </div>

      <Card padded={false}>
        <div className="p-5 sm:p-8">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px] [text-wrap:balance]">
            {t('roomsHeroTitle')}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{t('roomsHeroBody')}</p>
          <p className="mt-1 text-xs font-medium text-muted">
            {t('brand')} — {t('tagline')}
          </p>

          {phraseWasScrubbed && (
            <AlertBanner tone="warning" role="status" className="mt-4">
              {t('roomsPhraseScrubbed')}
            </AlertBanner>
          )}

          <div
            role="tablist"
            aria-label={t('navRooms')}
            className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={entryTab === 'create'}
              onClick={() => setEntryTab('create')}
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-accent ${
                entryTab === 'create' ? 'bg-surface-raised text-ink shadow-xs' : 'text-muted'
              }`}
            >
              <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
              {t('roomsCreate')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={entryTab === 'join'}
              onClick={() => setEntryTab('join')}
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-accent ${
                entryTab === 'join' ? 'bg-surface-raised text-ink shadow-xs' : 'text-muted'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              {t('roomsJoin')}
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
        </div>
      </Card>
    </main>
  );
}
