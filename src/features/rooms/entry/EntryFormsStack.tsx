import { AnimatePresence } from 'motion/react';
import { useT } from '../../../i18n';
import { AlertBanner } from '../../../components/ui/AlertBanner';
import type { RoomJoinParams } from '../../../hooks/useRoomManager';
import { CreateRoomForm } from '../CreateRoomForm';
import { JoinRoomForm } from '../JoinRoomForm';
import { TurnRelaySettings } from '../TurnRelaySettings';

type EntryFormsStackProps = {
  entryTab: 'create' | 'join' | null;
  stacked: boolean;
  errorMsg: string | null;
  showIceHint: boolean;
  isJoining: boolean;
  onJoinRoom: (params: RoomJoinParams) => Promise<void>;
  douseKey: number;
  createFormKey: number;
  inviteNonce: number;
  initialRoomId: string;
  initialPhrase: string | null;
};

export function EntryFormsStack({
  entryTab,
  stacked,
  errorMsg,
  showIceHint,
  isJoining,
  onJoinRoom,
  douseKey,
  createFormKey,
  inviteNonce,
  initialRoomId,
  initialPhrase,
}: EntryFormsStackProps) {
  const t = useT();

  if (!entryTab) return null;

  return (
    <>
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

      <AnimatePresence mode="wait" initial={false}>
        {entryTab === 'create' ? (
          <CreateRoomForm
            key={`create-${createFormKey}`}
            isJoining={isJoining}
            onJoinRoom={onJoinRoom}
            douseKey={douseKey}
            stacked={stacked}
          />
        ) : (
          <JoinRoomForm
            key={`join-${inviteNonce}-${initialRoomId}`}
            initialRoomId={initialRoomId}
            initialPhrase={initialPhrase}
            isJoining={isJoining}
            onJoinRoom={onJoinRoom}
            douseKey={douseKey}
            stacked={stacked}
          />
        )}
      </AnimatePresence>

      <TurnRelaySettings forceOpen={showIceHint} />
    </>
  );
}
