import { RoomEntryView } from '../../../features/rooms/RoomEntryView';
import type { RoomState } from '../../../hooks/useRoomManager';
import type { useToast } from '../../../components/ui/ToastHost';
import { useT } from '../../../i18n';
import type { RoomPanelActions } from '../useActiveRoomView';

type ToastApi = ReturnType<typeof useToast>;

export type RoomsChrome = {
  initialInvite: { roomId: string; phrase: string | null } | null;
  inviteNonce: number;
  isJoining: boolean;
  joinErrorMsg: string | null;
  showIceHint: boolean;
  activeRoomId: string | null;
  roomList: RoomState[];
};

export function RoomsTabPanel(props: {
  active: boolean;
  chrome: RoomsChrome;
  actions: Pick<RoomPanelActions, 'joinRoom' | 'switchRoom' | 'leaveRoom'>;
  /** In-room content id (may differ from list highlight activeRoomId). */
  contentRoomId: string | null;
  toast: ToastApi;
}) {
  const t = useT();
  const { chrome, actions, toast, contentRoomId } = props;

  return (
    <div
      className="tab-panel"
      data-active={props.active ? 'true' : 'false'}
      aria-hidden={!props.active}
      inert={!props.active ? true : undefined}
    >
      <RoomEntryView
        initialRoomId={chrome.initialInvite?.roomId}
        initialPhrase={chrome.initialInvite?.phrase}
        inviteNonce={chrome.inviteNonce}
        isJoining={chrome.isJoining}
        errorMsg={chrome.joinErrorMsg}
        showIceHint={chrome.showIceHint}
        activeRoomId={contentRoomId}
        joinedRooms={chrome.roomList}
        onJoinRoom={actions.joinRoom}
        onSwitchRoom={actions.switchRoom}
        onLeaveRoom={async (id) => {
          const wasActive = id === chrome.activeRoomId;
          await actions.leaveRoom(id);
          if (wasActive) {
            toast.push({
              message: t('roomsLeftToast'),
              tone: 'info',
              dedupeKey: 'leave-zone',
            });
          }
        }}
      />
    </div>
  );
}
