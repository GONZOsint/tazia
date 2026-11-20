import type { RefObject } from 'react';
import type { ActiveTab } from '../../components/layout/TopBar';
import type { useToast } from '../../components/ui/ToastHost';
import { DmsTabPanel, type DmChrome } from './tabs/DmsTabPanel';
import { ForumTabPanel } from './tabs/ForumTabPanel';
import { HowTabPanel } from './tabs/HowTabPanel';
import { PresenceTabPanel } from './tabs/PresenceTabPanel';
import { RoomsTabPanel, type RoomsChrome } from './tabs/RoomsTabPanel';
import type { ActiveRoomView, RoomPanelActions } from './useActiveRoomView';

type ToastApi = ReturnType<typeof useToast>;

export type AppTabPanelsProps = {
  mainContentRef: RefObject<HTMLDivElement | null>;
  fillLocked: boolean;
  activeTab: ActiveTab;
  mountedTabs: ReadonlySet<ActiveTab>;
  selectTab: (tab: ActiveTab) => void;
  roomView: ActiveRoomView;
  roomActions: RoomPanelActions;
  roomsChrome: RoomsChrome;
  dmChrome: DmChrome;
  toast: ToastApi;
};

export function AppTabPanels({
  mainContentRef,
  fillLocked,
  activeTab,
  mountedTabs,
  selectTab,
  roomView,
  roomActions,
  roomsChrome,
  dmChrome,
  toast,
}: AppTabPanelsProps) {
  return (
    <div
      ref={mainContentRef}
      id="main-content"
      tabIndex={-1}
      className={`flex min-h-0 flex-1 flex-col outline-none ${
        fillLocked ? 'overflow-hidden' : 'overflow-y-auto'
      }`}
    >
      {mountedTabs.has('rooms') && (
        <RoomsTabPanel
          active={activeTab === 'rooms'}
          chrome={roomsChrome}
          actions={roomActions}
          contentRoomId={roomView.roomId}
          toast={toast}
        />
      )}
      {mountedTabs.has('forum') && (
        <ForumTabPanel
          active={activeTab === 'forum'}
          roomView={roomView}
          actions={roomActions}
          selectTab={selectTab}
          toast={toast}
        />
      )}
      {mountedTabs.has('presence') && (
        <PresenceTabPanel
          active={activeTab === 'presence'}
          roomView={roomView}
          syncNow={roomActions.syncNow}
          resolvePeerTrust={roomActions.resolvePeerTrust}
          selectTab={selectTab}
        />
      )}
      {mountedTabs.has('dms') && (
        <DmsTabPanel
          active={activeTab === 'dms'}
          roomView={roomView}
          dmChrome={dmChrome}
          actions={roomActions}
          selectTab={selectTab}
          toast={toast}
        />
      )}
      {mountedTabs.has('how') && <HowTabPanel active={activeTab === 'how'} />}
    </div>
  );
}
