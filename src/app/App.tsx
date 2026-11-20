import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useToast } from '../components/ui/ToastHost';
import { useRoomManager } from '../hooks/useRoomManager';
import { useSessionFlame } from '../hooks/useSessionFlame';
import { useWakeLock } from '../hooks/useWakeLock';
import { useT } from '../i18n';
import { AppOverlays } from './appShell/AppOverlays';
import { AppShellLayout } from './appShell/AppShellLayout';
import { AppTabPanels } from './appShell/AppTabPanels';
import { useAppModals } from './appShell/useAppModals';
import { useAppNavigation } from './appShell/useAppNavigation';
import { useActiveRoomView } from './appShell/useActiveRoomView';
import { useTransportToasts } from './appShell/useTransportToasts';
import { useZoneChrome } from './appShell/useZoneChrome';

export default function App() {
  const t = useT();
  const toast = useToast();

  const {
    activeTab,
    mountedTabs,
    initialInvite,
    inviteNonce,
    dmPeerId,
    setDmPeerId,
    forumTabFocusedRef,
    dmsTabFocusedRef,
    activeDmPeerIdRef,
    mainContentRef,
    roomCtxRef,
    selectTab,
    onNavigateTab,
  } = useAppNavigation();

  /** Bridge: zone chrome hook runs after manager (needs activeRoomId). */
  const zoneIgniteRef = useRef<(roomId: string) => void>(() => {});
  const onZoneIgnited = useCallback((roomId: string) => {
    zoneIgniteRef.current(roomId);
  }, []);

  const {
    rooms,
    activeRoomId,
    activeRoom,
    presenceAliases,
    presenceAvatarSeeds,
    isJoining,
    joinError,
    burnNotice,
    dismissBurnNotice,
    ipConsentNeeded,
    totalForumUnread,
    totalDmUnread,
    confirmIpConsent,
    cancelIpConsent,
    joinRoom,
    leaveRoom,
    switchRoom,
    burnSession,
    setSessionTearingDown,
    publish,
    syncNow,
    sendDm,
    clearDmUnread,
    clearForumUnread,
    dismissRoomError,
    dismissTransportNotice,
    dismissKeyChange,
  } = useRoomManager(onNavigateTab, {
    forumTabFocusedRef,
    dmsTabFocusedRef,
    activeDmPeerIdRef,
    onZoneIgnited,
  });

  // Peek before room-manager consume is already done; burnNotice state is source of truth.
  // Cold-load invite auto-lit only when not returning from an extinguish.
  const { lit: sessionLit, ignite } = useSessionFlame({
    autoIgnite: Boolean(initialInvite?.roomId) && !burnNotice,
    burnNotice,
  });

  const igniteSession = useCallback(() => {
    dismissBurnNotice();
    ignite();
  }, [dismissBurnNotice, ignite]);

  roomCtxRef.current = {
    activeRoomId,
    clearForumUnread,
    clearDmUnread,
  };

  const { igniteRoomId, zoneSwitchPulse, handleZoneIgnited } = useZoneChrome(
    activeRoomId,
    setDmPeerId
  );
  zoneIgniteRef.current = handleZoneIgnited;

  useWakeLock(Boolean(activeRoomId));

  const onBurnStart = useCallback(() => {
    setSessionTearingDown(true);
  }, [setSessionTearingDown]);

  const {
    burnConfirmOpen,
    burnPlaying,
    modalOpen,
    openBurnConfirm,
    cancelBurnConfirm,
    confirmBurn,
  } = useAppModals(burnSession, ipConsentNeeded, onBurnStart);

  useEffect(() => {
    setSessionTearingDown(burnPlaying);
  }, [burnPlaying, setSessionTearingDown]);

  const roomView = useActiveRoomView(
    activeRoom,
    presenceAliases,
    presenceAvatarSeeds,
    t
  );

  const joinErrorMsg = joinError ? t(joinError.key, joinError.vars) : null;
  const showIceHint =
    joinError?.key === 'errPeerConnect' ||
    joinError?.key === 'errLocalNetworkDenied' ||
    activeRoom?.roomError?.key === 'errPeerConnect' ||
    activeRoom?.roomError?.key === 'errLocalNetworkDenied';

  useTransportToasts({
    activeRoomId,
    transportNotice: roomView.transportNotice,
    dismissTransportNotice,
    toast,
    t,
  });

  const roomList = useMemo(() => [...rooms.values()], [rooms]);
  const plazaLocked = activeTab === 'forum' && roomView.isInRoom;
  const dmsThreadOpen = activeTab === 'dms' && Boolean(dmPeerId);
  const fillLocked = plazaLocked || dmsThreadOpen;
  const splashShort = Boolean(initialInvite?.roomId);

  const activeZone = useMemo(
    () =>
      activeRoom
        ? {
            roomId: activeRoom.roomId,
            meshStatus: activeRoom.meshStatus,
            onlineUserIds: activeRoom.onlineUserIds,
            selfUserId: activeRoom.selfUserId,
            relayActive: activeRoom.relayFallbackActive,
          }
        : null,
    [
      activeRoom?.roomId,
      activeRoom?.meshStatus,
      activeRoom?.onlineUserIds,
      activeRoom?.selfUserId,
      activeRoom?.relayFallbackActive,
    ]
  );

  const resolvePeerTrust = useCallback(
    (userId: string) => {
      if (!activeRoomId) return;
      // Caller already applied applyTrustSasConfirm; only refresh crypto + dismiss alert.
      void activeRoom?.session.invalidatePeerKey(userId);
      dismissKeyChange(activeRoomId, userId);
    },
    [activeRoom, activeRoomId, dismissKeyChange]
  );

  const roomActions = useMemo(
    () => ({
      publish,
      syncNow,
      sendDm,
      clearDmUnread,
      dismissRoomError,
      joinRoom,
      switchRoom,
      leaveRoom,
      resolvePeerTrust,
    }),
    [
      publish,
      syncNow,
      sendDm,
      clearDmUnread,
      dismissRoomError,
      joinRoom,
      switchRoom,
      leaveRoom,
      resolvePeerTrust,
    ]
  );

  const roomsChrome = useMemo(
    () => ({
      initialInvite,
      inviteNonce,
      isJoining,
      joinErrorMsg,
      showIceHint,
      activeRoomId,
      roomList,
    }),
    [
      initialInvite,
      inviteNonce,
      isJoining,
      joinErrorMsg,
      showIceHint,
      activeRoomId,
      roomList,
    ]
  );

  const dmChrome = useMemo(
    () => ({
      dmPeerId,
      setDmPeerId,
      dmsThreadOpen,
    }),
    [dmPeerId, setDmPeerId, dmsThreadOpen]
  );

  return (
    <AppShellLayout
      splashShort={splashShort}
      sessionLit={sessionLit}
      onIgnite={igniteSession}
      activeTab={activeTab}
      selectTab={selectTab}
      isInRoom={roomView.isInRoom}
      totalForumUnread={totalForumUnread}
      totalDmUnread={totalDmUnread}
      roomsCount={roomList.length}
      activeZone={activeZone}
      burnHeating={burnPlaying}
      igniting={Boolean(igniteRoomId && activeRoomId === igniteRoomId)}
      zoneSwitchPulse={zoneSwitchPulse}
      onBurnSession={openBurnConfirm}
      swipeDisabled={modalOpen || burnPlaying || fillLocked}
      overlays={
        <AppOverlays
          ipConsentNeeded={ipConsentNeeded}
          onAcceptIpConsent={() => void confirmIpConsent()}
          onCancelIpConsent={cancelIpConsent}
          onOpenFix={() => {
            selectTab('rooms');
            window.dispatchEvent(new Event('tazia:open-fix'));
            requestAnimationFrame(() => {
              document.getElementById('turn-relay-settings')?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            });
          }}
          burnConfirmOpen={burnConfirmOpen}
          onCancelBurnConfirm={cancelBurnConfirm}
          onConfirmBurn={confirmBurn}
          activeRoom={activeRoom}
          activeRoomId={activeRoomId}
          keyChangeAlerts={roomView.keyChangeAlerts}
          presence={roomView.presence}
          dismissKeyChange={dismissKeyChange}
        />
      }
      panels={
        <AppTabPanels
          mainContentRef={mainContentRef}
          fillLocked={fillLocked}
          activeTab={activeTab}
          mountedTabs={mountedTabs}
          selectTab={selectTab}
          roomView={roomView}
          roomActions={roomActions}
          roomsChrome={roomsChrome}
          dmChrome={dmChrome}
          toast={toast}
        />
      }
    />
  );
}
