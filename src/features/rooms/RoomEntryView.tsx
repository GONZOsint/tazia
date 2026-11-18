import { useState } from 'react';
import { KeyRound, PlusCircle } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import type { RoomJoinParams } from '../../hooks/useTaziaSession';
import { useT } from '../../i18n';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { Card } from '../../components/ui/Card';
import { CreateRoomForm } from './CreateRoomForm';
import { JoinRoomForm } from './JoinRoomForm';
import { RoomHowAside } from './RoomHowAside';

interface RoomEntryViewProps {
  initialRoomId?: string;
  initialPhrase?: string | null;
  phraseWasScrubbed?: boolean;
  isJoining: boolean;
  errorMsg: string | null;
  activeRoomId?: string | null;
  onGoToForum?: () => void;
  onBurnSession?: () => void;
  onJoinRoom: (params: RoomJoinParams) => Promise<void>;
}

export function RoomEntryView({
  initialRoomId = '',
  initialPhrase = null,
  phraseWasScrubbed = false,
  isJoining,
  errorMsg,
  activeRoomId = null,
  onGoToForum,
  onBurnSession,
  onJoinRoom,
}: RoomEntryViewProps) {
  const t = useT();
  const hasInvite = Boolean(initialRoomId);
  const [entryTab, setEntryTab] = useState<'create' | 'join'>(hasInvite ? 'join' : 'create');

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8 lg:py-10">
      {activeRoomId && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ok-border bg-ok-bg px-4 py-3 text-sm text-ok-ink">
          <p>
            {t('roomsActivePrefix')}{' '}
            <span className="font-mono text-xs">{activeRoomId}</span>. {t('roomsActiveHint')}
          </p>
          <div className="flex flex-wrap gap-2">
            {onGoToForum && (
              <button
                type="button"
                onClick={onGoToForum}
                className="min-h-[44px] rounded-lg border border-ok-border bg-surface-raised px-3 py-1.5 text-xs font-semibold"
              >
                {t('roomsBackToChat')}
              </button>
            )}
            {onBurnSession && (
              <button
                type="button"
                onClick={onBurnSession}
                className="min-h-[44px] rounded-lg border border-danger-border bg-danger-bg px-3 py-1.5 text-xs font-semibold text-danger-ink"
              >
                {t('leaveTab')}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Card className="p-5 sm:p-8" padded={false}>
          <div className="p-5 sm:p-8">
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px] [text-wrap:balance]">
              {t('roomsHeroTitle')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t('roomsHeroBody')}</p>
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
                className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
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
                className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
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
          </div>
        </Card>

        <RoomHowAside />
      </div>
    </main>
  );
}
