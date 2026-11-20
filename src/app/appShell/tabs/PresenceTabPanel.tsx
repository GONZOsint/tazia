import { lazy, Suspense } from 'react';
import { TabSkeleton } from '../TabSkeleton';
import type { ActiveRoomView, RoomPanelActions } from '../useActiveRoomView';

const PresenceView = lazy(() => import('../../../features/presence/PresenceView'));

export function PresenceTabPanel(props: {
  active: boolean;
  roomView: ActiveRoomView;
  syncNow: RoomPanelActions['syncNow'];
  resolvePeerTrust: RoomPanelActions['resolvePeerTrust'];
  selectTab: (tab: 'rooms') => void;
}) {
  const v = props.roomView;

  return (
    <div
      className="tab-panel"
      data-active={props.active ? 'true' : 'false'}
      aria-hidden={!props.active}
      inert={!props.active ? true : undefined}
    >
      <Suspense fallback={<TabSkeleton />}>
        <PresenceView
          selfUserId={v.selfUserId}
          selfSignPubKeyB64={v.selfSignPubKeyB64}
          trustStore={v.trustStore}
          presence={v.presence}
          onlineUserIds={v.onlineUserIds}
          meshStatus={v.meshStatus}
          peerOnlineCount={v.peerOnlineCount}
          rejectedSyncCount={v.rejectedSyncCount}
          roomId={v.roomId}
          relayActive={v.relayActive}
          onSyncNow={props.syncNow}
          isSyncing={v.isSyncing}
          onGoToRooms={() => props.selectTab('rooms')}
          onPeerTrustResolved={props.resolvePeerTrust}
        />
      </Suspense>
    </div>
  );
}
