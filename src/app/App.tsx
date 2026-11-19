import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Flame, Loader2, Radio } from 'lucide-react';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { BottomNav } from '../components/layout/BottomNav';
import { TopBar, type ActiveTab } from '../components/layout/TopBar';
import { AlertBanner } from '../components/ui/AlertBanner';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useToast } from '../components/ui/ToastHost';
import { BurnFireOverlay } from '../components/session/BurnFireOverlay';
import { KeyChangeAlert } from '../components/session/KeyChangeAlert';
import { IpConsentModal } from '../features/rooms/IpConsentModal';
import { RoomEntryView } from '../features/rooms/RoomEntryView';
import { countOtherPeers, useRoomManager } from '../hooks/useRoomManager';
import { useWakeLock } from '../hooks/useWakeLock';
import { useT } from '../i18n';
import { DUR, EASE, IGNITE, TAP, TAP_TRANSITION, contentSwitch, enterPlaza } from '../motion/tokens';
import { parseInviteInput, scrubPhraseFromLocationHash } from '../core/utils/inviteLink';

const ForumWorkspace = lazy(() => import('../features/forum/ForumWorkspace'));
const HowItWorksView = lazy(() => import('../features/how/HowItWorksView'));
const PresenceView = lazy(() => import('../features/presence/PresenceView'));
const DmListView = lazy(() => import('../features/dms/DmListView'));
const DmConversationView = lazy(() => import('../features/dms/DmConversationView'));

function TabSkeleton() {
  return (
    <motion.div
      className="mx-auto flex max-w-[1280px] items-center justify-center px-4 py-16"
      initial={contentSwitch.initial}
      animate={contentSwitch.animate}
      transition={contentSwitch.transition}
    >
      <Loader2 className="h-6 w-6 animate-spin text-faint" />
    </motion.div>
  );
}

function readInitialInvite() {
  const parsed = parseInviteInput(window.location.hash);
  if (parsed?.phrase) {
    scrubPhraseFromLocationHash(parsed.roomId);
  }
  return parsed;
}

export default function App() {
  const t = useT();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('rooms');
  const [initialInvite] = useState(readInitialInvite);
  const relayToastShownRef = useRef<string | null>(null);
  const forumTabFocusedRef = useRef(false);
  const dmsTabFocusedRef = useRef(false);
  const activeDmPeerIdRef = useRef<string | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [burnConfirmOpen, setBurnConfirmOpen] = useState(false);
  const [burnPlaying, setBurnPlaying] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [dmPeerId, setDmPeerId] = useState<string | null>(null);
  const [igniteRoomId, setIgniteRoomId] = useState<string | null>(null);
  const [zoneSwitchPulse, setZoneSwitchPulse] = useState(false);
  const skipNextZoneSwitchPulseRef = useRef(false);
  const igniteTimerRef = useRef<number | null>(null);

  const handleZoneIgnited = useCallback((roomId: string) => {
    skipNextZoneSwitchPulseRef.current = true;
    setIgniteRoomId(roomId);
    if (igniteTimerRef.current !== null) window.clearTimeout(igniteTimerRef.current);
    igniteTimerRef.current = window.setTimeout(() => {
      setIgniteRoomId((cur) => (cur === roomId ? null : cur));
      igniteTimerRef.current = null;
    }, IGNITE.finishMs);
  }, []);

  const {
    rooms,
    activeRoomId,
    activeRoom,
    presenceAliases,
    isJoining,
    joinError,
    burnNotice,
    ipConsentNeeded,
    totalForumUnread,
    totalDmUnread,
    confirmIpConsent,
    cancelIpConsent,
    joinRoom,
    leaveRoom,
    switchRoom,
    burnSession,
    publish,
    syncNow,
    sendDm,
    clearDmUnread,
    clearForumUnread,
    dismissRoomError,
    dismissTransportNotice,
    dismissKeyChange,
  } = useRoomManager(
    (tab) => {
      forumTabFocusedRef.current = tab === 'forum';
      dmsTabFocusedRef.current = false;
      setActiveTab(tab as ActiveTab);
    },
    {
      forumTabFocusedRef,
      dmsTabFocusedRef,
      activeDmPeerIdRef,
      onZoneIgnited: handleZoneIgnited,
    }
  );

  useWakeLock(Boolean(activeRoomId));

  useEffect(() => {
    activeDmPeerIdRef.current = dmPeerId;
  }, [dmPeerId]);

  useEffect(() => {
    forumTabFocusedRef.current = activeTab === 'forum';
    dmsTabFocusedRef.current = activeTab === 'dms';
    if (activeTab === 'forum' && activeRoomId) clearForumUnread(activeRoomId);
    if (activeTab === 'dms' && dmPeerId) clearDmUnread(dmPeerId);
  }, [activeTab, activeRoomId, dmPeerId, clearForumUnread, clearDmUnread]);

  const prevActiveRoomIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevActiveRoomIdRef.current === activeRoomId) return;
    const prev = prevActiveRoomIdRef.current;
    prevActiveRoomIdRef.current = activeRoomId;
    setDmPeerId(null);
    if (!activeRoomId || prev === null) return;
    if (skipNextZoneSwitchPulseRef.current) {
      skipNextZoneSwitchPulseRef.current = false;
      return;
    }
    setZoneSwitchPulse(true);
    const t = window.setTimeout(() => setZoneSwitchPulse(false), IGNITE.glowMs);
    return () => window.clearTimeout(t);
  }, [activeRoomId]);

  useEffect(() => {
    return () => {
      if (igniteTimerRef.current !== null) window.clearTimeout(igniteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setModalOpen(ipConsentNeeded || burnConfirmOpen || burnPlaying);
  }, [ipConsentNeeded, burnConfirmOpen, burnPlaying]);

  const finishBurnChoreography = useCallback(() => {
    setDmPeerId(null);
    setBurnPlaying(false);
    void burnSession();
  }, [burnSession]);

  const selectTab = (tab: ActiveTab) => {
    forumTabFocusedRef.current = tab === 'forum';
    dmsTabFocusedRef.current = tab === 'dms';
    if (tab === 'forum' && activeRoomId) clearForumUnread(activeRoomId);
    if (tab === 'dms' && dmPeerId) clearDmUnread(dmPeerId);
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      mainContentRef.current?.focus({ preventScroll: true });
    });
  };

  const isInRoom = activeRoom !== null;
  const roomId = activeRoom?.roomId ?? null;
  const phrase = activeRoom?.phrase ?? null;
  const profile = activeRoom?.profile ?? null;
  const selfUserId = activeRoom?.selfUserId ?? null;
  const selfSignPubKeyB64 = activeRoom?.selfSignPubKeyB64 ?? null;
  const trustStore = activeRoom?.trustStore ?? null;
  const messages = activeRoom?.messages ?? [];
  const presence = activeRoom?.presence ?? {};
  const onlineUserIds = activeRoom?.onlineUserIds ?? [];
  const peerOnlineCount = countOtherPeers(onlineUserIds, selfUserId);
  const isPublishing = activeRoom?.isPublishing ?? false;
  const isSyncing = activeRoom?.isSyncing ?? false;
  const meshStatus = activeRoom?.meshStatus ?? 'connecting';
  const rejectedSyncCount = activeRoom?.rejectedSyncCount ?? 0;
  const roomError = activeRoom?.roomError ?? null;
  const transportNotice = activeRoom?.transportNotice ?? null;
  const keyChangeAlerts = activeRoom?.keyChangeAlerts ?? [];
  const dmMessages = activeRoom?.dmMessages ?? {};
  const dmUnread = activeRoom?.dmUnread ?? {};

  const joinErrorMsg = joinError ? t(joinError.key, joinError.vars) : null;
  const roomErrorMsg = roomError ? t(roomError.key, roomError.vars) : null;
  const showIceHint =
    joinError?.key === 'errPeerConnect' ||
    joinError?.key === 'errLocalNetworkDenied' ||
    roomError?.key === 'errPeerConnect' ||
    roomError?.key === 'errLocalNetworkDenied';
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeRoomId) {
      relayToastShownRef.current = null;
      return;
    }
    if (!transportNotice) return;
    const stamp = `${activeRoomId}:${transportNotice.key}`;
    if (relayToastShownRef.current === stamp) {
      dismissTransportNotice();
      return;
    }
    relayToastShownRef.current = stamp;
    toast.push({
      message: t(transportNotice.key, transportNotice.vars),
      tone: 'warning',
      dedupeKey: stamp,
    });
    dismissTransportNotice();
  }, [transportNotice, activeRoomId, dismissTransportNotice, t, toast]);

  const TABS = ['rooms', 'forum', 'presence', 'dms', 'how'] as const;
  useSwipeTabs(mainRef, {
    tabs: TABS,
    activeTab: activeTab as (typeof TABS)[number],
    onSwipe: (tab) => selectTab(tab as ActiveTab),
    disabled: modalOpen,
  });

  const roomList = [...rooms.values()];

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={mainRef}
        className="min-h-screen bg-bg text-ink pb-[calc(3.25rem+env(safe-area-inset-bottom))] md:pb-0"
      >
        <TopBar
          activeTab={activeTab}
          onSelectTab={selectTab}
          hasActiveRoom={isInRoom}
          forumUnread={totalForumUnread}
          dmUnread={totalDmUnread}
          roomsCount={roomList.length}
          activeZone={
            activeRoom
              ? {
                  roomId: activeRoom.roomId,
                  meshStatus: activeRoom.meshStatus,
                  onlineUserIds: activeRoom.onlineUserIds,
                  selfUserId: activeRoom.selfUserId,
                  relayActive: activeRoom.relayFallbackActive,
                }
              : null
          }
          burnHeating={burnPlaying}
          igniting={Boolean(igniteRoomId && activeRoomId === igniteRoomId)}
          zoneSwitchPulse={zoneSwitchPulse}
          onBurnSession={() => setBurnConfirmOpen(true)}
        />

        <BurnFireOverlay play={burnPlaying} onComplete={finishBurnChoreography} />

        <AnimatePresence initial={false}>
          {burnNotice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: DUR.medium, ease: EASE.outExpo }}
              className="mx-auto mt-4 flex max-w-[1280px] items-center px-4 sm:px-8"
            >
              <AlertBanner tone="success" role="status" className="w-full">
                {t('burnNotice')}
              </AlertBanner>
            </motion.div>
          )}
        </AnimatePresence>

        <IpConsentModal
          open={ipConsentNeeded}
          onAccept={() => void confirmIpConsent()}
          onCancel={cancelIpConsent}
        />

        <ConfirmModal
          open={burnConfirmOpen}
          title={t('burnConfirmTitle')}
          body={t('burnConfirmBody')}
          confirmLabel={t('burnConfirmAction')}
          danger
          icon={Flame}
          onCancel={() => setBurnConfirmOpen(false)}
          onConfirm={() => {
            setBurnConfirmOpen(false);
            setBurnPlaying(true);
          }}
        />

        {keyChangeAlerts.length > 0 && activeRoomId && (
          <div className="mx-auto mt-4 max-w-[1280px] space-y-2 px-4 sm:px-8">
            {keyChangeAlerts.map((alert) => (
              <KeyChangeAlert
                key={alert.userId}
                peerAlias={presence[alert.userId]?.alias || alert.userId}
                onRepin={() => {
                  trustStore?.repin(alert.userId);
                  dismissKeyChange(activeRoomId, alert.userId);
                }}
                onDisconnect={() => {
                  dismissKeyChange(activeRoomId, alert.userId);
                  void leaveRoom(activeRoomId);
                }}
                onDismiss={() => dismissKeyChange(activeRoomId, alert.userId)}
              />
            ))}
          </div>
        )}

        <div ref={mainContentRef} id="main-content" tabIndex={-1} className="outline-none">
          <Suspense fallback={<TabSkeleton />}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                initial={contentSwitch.initial}
                animate={contentSwitch.animate}
                exit={contentSwitch.exit}
                transition={contentSwitch.transition}
              >
                {activeTab === 'forum' &&
                  (isInRoom && roomId && profile && selfUserId ? (
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={roomId}
                        initial={enterPlaza.initial}
                        animate={enterPlaza.animate}
                        exit={enterPlaza.exit}
                      >
                        <ForumWorkspace
                          roomId={roomId}
                          phrase={phrase}
                          profile={profile}
                          selfUserId={selfUserId}
                          messages={messages}
                          presenceAliases={presenceAliases}
                          onlineCount={peerOnlineCount}
                          meshStatus={meshStatus}
                          relayActive={Boolean(activeRoom?.relayFallbackActive)}
                          isPublishing={isPublishing}
                          isSyncing={isSyncing}
                          roomError={roomErrorMsg}
                          roomErrorTone="error"
                          onDismissRoomError={dismissRoomError}
                          onSyncNow={async () => {
                            await syncNow();
                          }}
                          onCreateThread={async (title, body) => {
                            const ok = await publish({
                              type: 'NEW_THREAD',
                              threadId: crypto.randomUUID(),
                              parentMsgId: null,
                              title,
                              body,
                            });
                            if (!ok) toast.push(t('toastPublishFailed'), 'error');
                            return ok;
                          }}
                          onReplyThread={async (threadId, parentMsgId, body) => {
                            const ok = await publish({
                              type: 'REPLY',
                              threadId,
                              parentMsgId,
                              title: '',
                              body,
                            });
                            if (!ok) toast.push(t('toastPublishFailed'), 'error');
                            return ok;
                          }}
                        />
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    <main className="mx-auto max-w-[560px] px-4 py-10 text-center sm:px-8">
                      <Radio className="mx-auto h-12 w-12 text-faint" aria-hidden="true" strokeWidth={1.5} />
                      <motion.button
                        whileTap={TAP}
                        transition={TAP_TRANSITION}
                        type="button"
                        onClick={() => selectTab('rooms')}
                        aria-label={t('forumEmptyCta')}
                        className="btn-accent-sheen mt-6 inline-flex min-h-[48px] min-w-[48px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                      >
                        <Radio className="h-5 w-5" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">{t('navRooms')}</span>
                      </motion.button>
                    </main>
                  ))}

                {activeTab === 'rooms' && (
                  <RoomEntryView
                    initialRoomId={initialInvite?.roomId}
                    initialPhrase={initialInvite?.phrase}
                    isJoining={isJoining}
                    errorMsg={joinErrorMsg}
                    showIceHint={showIceHint}
                    activeRoomId={roomId}
                    joinedRooms={roomList}
                    onJoinRoom={joinRoom}
                    onSwitchRoom={switchRoom}
                    onLeaveRoom={async (id) => {
                      const wasActive = id === activeRoomId;
                      await leaveRoom(id);
                      if (wasActive) {
                        toast.push({
                          message: t('roomsLeftToast'),
                          tone: 'info',
                          dedupeKey: 'leave-zone',
                        });
                      }
                    }}
                  />
                )}

                {activeTab === 'presence' && (
                  <PresenceView
                    selfUserId={selfUserId}
                    selfSignPubKeyB64={selfSignPubKeyB64}
                    trustStore={trustStore}
                    presence={presence}
                    onlineUserIds={onlineUserIds}
                    meshStatus={meshStatus}
                    peerOnlineCount={peerOnlineCount}
                    rejectedSyncCount={rejectedSyncCount}
                    roomId={roomId}
                    relayActive={Boolean(activeRoom?.relayFallbackActive)}
                    onSyncNow={syncNow}
                    isSyncing={isSyncing}
                    onGoToRooms={() => selectTab('rooms')}
                  />
                )}

                {activeTab === 'dms' &&
                  (dmPeerId && selfUserId ? (
                    <DmConversationView
                      selfUserId={selfUserId}
                      peerId={dmPeerId}
                      peerAlias={presence[dmPeerId]?.alias || dmPeerId}
                      messages={dmMessages[dmPeerId] ?? []}
                      onSend={async (body) => {
                        const ok = await sendDm(dmPeerId, body);
                        if (!ok) toast.push(t('toastDmFailed'), 'error');
                        return ok;
                      }}
                      onBack={() => {
                        clearDmUnread(dmPeerId);
                        setDmPeerId(null);
                      }}
                    />
                  ) : (
                    <DmListView
                      selfUserId={selfUserId}
                      presence={presence}
                      onlineUserIds={onlineUserIds}
                      dmMessages={dmMessages}
                      dmUnread={dmUnread}
                      onGoToRooms={() => selectTab('rooms')}
                      onSelectPeer={(peerId) => {
                        clearDmUnread(peerId);
                        setDmPeerId(peerId);
                      }}
                    />
                  ))}

                {activeTab === 'how' && <HowItWorksView />}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </div>

        <BottomNav
          activeTab={activeTab}
          onSelectTab={selectTab}
          forumUnread={totalForumUnread}
          dmUnread={totalDmUnread}
          roomsCount={roomList.length}
        />
      </div>
    </MotionConfig>
  );
}
