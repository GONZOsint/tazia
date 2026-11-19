import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Flame, Loader2, Radio } from 'lucide-react';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { BottomNav } from '../components/layout/BottomNav';
import { TopBar, type ActiveTab } from '../components/layout/TopBar';
import { AlertBanner } from '../components/ui/AlertBanner';
import { EmptyZoneCta } from '../components/ui/AccentButton';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useToast } from '../components/ui/ToastHost';
import { BurnFireOverlay } from '../components/session/BurnFireOverlay';
import { KeyChangeAlert } from '../components/session/KeyChangeAlert';
import { IpConsentModal } from '../features/rooms/IpConsentModal';
import { AppSplash } from '../components/brand/AppSplash';
import { RoomEntryView } from '../features/rooms/RoomEntryView';
import { countOtherPeers, useRoomManager } from '../hooks/useRoomManager';
import { useWakeLock } from '../hooks/useWakeLock';
import { useT } from '../i18n';
import {
  DUR,
  EASE,
  IGNITE,
  TAP,
  TAP_TRANSITION,
  bannerEnter,
  contentSwitch,
  enterPlaza,
} from '../motion/tokens';
import { haptic, HAPTIC_RITUAL, HAPTIC_TAP } from '../motion/haptic';
import { cachedPeerVisual } from '../core/crypto/identity';
import { DELETE_VOTE_AYE, encodeElectorate } from '../core/forum/threadDelete';
import {
  parseInviteInput,
  scrubPhraseFromLocationHash,
  takeBootstrappedInvitePhrase,
} from '../core/utils/inviteLink';

const ForumWorkspace = lazy(() => import('../features/forum/ForumWorkspace'));
const HowItWorksView = lazy(() => import('../features/how/HowItWorksView'));
const PresenceView = lazy(() => import('../features/presence/PresenceView'));
const DmListView = lazy(() => import('../features/dms/DmListView'));
const DmConversationView = lazy(() => import('../features/dms/DmConversationView'));

const ALL_TABS = ['rooms', 'forum', 'presence', 'dms', 'how'] as const satisfies readonly ActiveTab[];

function TabSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DUR.micro, ease: EASE.outExpo }}
      className="mx-auto flex max-w-[1280px] items-center justify-center px-4 py-16"
    >
      <Loader2 className="h-6 w-6 animate-spin text-faint" />
    </motion.div>
  );
}

/** Parse #room[~phrase], prefer live hash phrase, else early-boot stash; scrub secret from URL. */
function consumeInviteFromLocation() {
  const parsed = parseInviteInput(window.location.hash);
  if (!parsed) return null;
  if (parsed.phrase) {
    scrubPhraseFromLocationHash(parsed.roomId);
    return parsed;
  }
  const bootPhrase = takeBootstrappedInvitePhrase(parsed.roomId);
  if (bootPhrase) return { roomId: parsed.roomId, phrase: bootPhrase };
  return parsed;
}

export default function App() {
  const t = useT();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('rooms');
  const [initialInvite, setInitialInvite] = useState(consumeInviteFromLocation);
  /** Bumps when a new invite arrives mid-session (hashchange / same-tab open). */
  const [inviteNonce, setInviteNonce] = useState(0);
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
  /** Keep visited tabs mounted — avoids Suspense/hero remount flicker on return. */
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<ActiveTab>>(
    () => new Set<ActiveTab>(['rooms'])
  );

  const handleZoneIgnited = useCallback((roomId: string) => {
    skipNextZoneSwitchPulseRef.current = true;
    setIgniteRoomId(roomId);
    if (igniteTimerRef.current !== null) window.clearTimeout(igniteTimerRef.current);
    igniteTimerRef.current = window.setTimeout(() => {
      setIgniteRoomId((cur) => (cur === roomId ? null : cur));
      igniteTimerRef.current = null;
    }, IGNITE.finishMs); // spark → ring → glow settle
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
    haptic(HAPTIC_TAP);
    // Same IGNITE settle window as forge / zone-join card pulse.
    const t = window.setTimeout(() => setZoneSwitchPulse(false), IGNITE.finishMs);
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

  // Same-tab / PWA: opening #room~phrase only fires hashchange (no scrub-phrase.js re-run).
  useEffect(() => {
    const onHashChange = () => {
      const next = consumeInviteFromLocation();
      if (!next?.roomId) return;
      setInitialInvite(next);
      setInviteNonce((n) => n + 1);
      setActiveTab('rooms');
      setMountedTabs((prev) => {
        if (prev.has('rooms')) return prev;
        const copy = new Set(prev);
        copy.add('rooms');
        return copy;
      });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const finishBurnChoreography = useCallback(() => {
    // Keep burnPlaying true through teardown/reload so the overlay veil
    // never unmounts (that snap-back was the session flicker).
    void burnSession();
  }, [burnSession]);

  const selectTab = (tab: ActiveTab) => {
    if (tab === activeTab) return;
    forumTabFocusedRef.current = tab === 'forum';
    dmsTabFocusedRef.current = tab === 'dms';
    if (tab === 'forum' && activeRoomId) clearForumUnread(activeRoomId);
    if (tab === 'dms' && dmPeerId) clearDmUnread(dmPeerId);
    // Mobile-messenger pattern: leave thread when leaving Susurros so unread stays honest.
    if (tab !== 'dms') setDmPeerId(null);
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
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

  useSwipeTabs(mainRef, {
    tabs: ALL_TABS,
    activeTab,
    onSwipe: (tab) => selectTab(tab),
    disabled: modalOpen || burnPlaying,
  });

  const roomList = [...rooms.values()];
  const plazaLocked = activeTab === 'forum' && isInRoom;
  const dmsThreadOpen = activeTab === 'dms' && Boolean(dmPeerId);
  const fillLocked = plazaLocked || dmsThreadOpen;

  // Also mount tabs navigated via join/switchRoom (bypasses selectTab).
  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const splashShort = Boolean(initialInvite?.roomId);

  return (
    <MotionConfig reducedMotion="user">
      <AppSplash short={splashShort} />
      <div
        ref={mainRef}
        className="flex h-dvh flex-col overflow-hidden bg-bg text-ink pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:pb-0"
      >
        {/* Soft plume filter for hero burn phrase (no SourceGraphic — no hard dots on letters). */}
        <svg width="0" height="0" className="pointer-events-none absolute" aria-hidden="true" focusable="false">
          <defs>
            <filter id="tazia-fire-plume" x="-40%" y="-120%" width="180%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 12 -5"
                result="plume"
              />
            </filter>
          </defs>
        </svg>
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
              initial={bannerEnter.initial}
              animate={bannerEnter.animate}
              exit={bannerEnter.exit}
              transition={bannerEnter.transition}
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
            haptic(HAPTIC_RITUAL);
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
                  void activeRoom?.session.invalidatePeerKey(alert.userId);
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

        <div
          ref={mainContentRef}
          id="main-content"
          tabIndex={-1}
          className={`flex min-h-0 flex-1 flex-col outline-none ${
            fillLocked ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {mountedTabs.has('rooms') && (
            <div
              className="tab-panel"
              data-active={activeTab === 'rooms' ? 'true' : 'false'}
              aria-hidden={activeTab !== 'rooms'}
              inert={activeTab !== 'rooms' ? true : undefined}
            >
              <RoomEntryView
                initialRoomId={initialInvite?.roomId}
                initialPhrase={initialInvite?.phrase}
                inviteNonce={inviteNonce}
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
            </div>
          )}

          {mountedTabs.has('forum') && (
            <div
              className="tab-panel"
              data-active={activeTab === 'forum' ? 'true' : 'false'}
              data-fill={activeTab === 'forum' && isInRoom ? 'true' : undefined}
              aria-hidden={activeTab !== 'forum'}
              inert={activeTab !== 'forum' ? true : undefined}
            >
              <Suspense fallback={<TabSkeleton />}>
                {isInRoom && roomId && profile && selfUserId ? (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={roomId}
                      initial={enterPlaza.initial}
                      animate={enterPlaza.animate}
                      exit={enterPlaza.exit}
                      className="flex h-full min-h-0 flex-1 flex-col"
                    >
                      <ForumWorkspace
                        roomId={roomId}
                        phrase={phrase}
                        profile={profile}
                        selfUserId={selfUserId}
                        messages={messages}
                        presenceAliases={presenceAliases}
                        onlineUserIds={onlineUserIds}
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
                        onProposeDeleteThread={async (threadId, electorate) => {
                          const body = encodeElectorate(electorate);
                          if (!body) {
                            toast.push(t('toastPublishFailed'), 'error');
                            return false;
                          }
                          const ok = await publish({
                            type: 'DELETE_PROPOSE',
                            threadId,
                            parentMsgId: null,
                            title: '',
                            body,
                          });
                          if (!ok) toast.push(t('toastPublishFailed'), 'error');
                          return ok;
                        }}
                        onVoteDeleteThread={async (threadId, proposalMsgId) => {
                          const ok = await publish({
                            type: 'DELETE_VOTE',
                            threadId,
                            parentMsgId: proposalMsgId,
                            title: '',
                            body: DELETE_VOTE_AYE,
                          });
                          if (!ok) toast.push(t('toastPublishFailed'), 'error');
                          return ok;
                        }}
                      />
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <EmptyZoneCta
                    icon={<Radio className="h-12 w-12 text-faint" aria-hidden="true" strokeWidth={1.5} />}
                    title={t('forumEmptyTitle')}
                    body={t('forumEmptyBody')}
                    actionLabel={t('forumEmptyCta')}
                    onAction={() => selectTab('rooms')}
                  />
                )}
              </Suspense>
            </div>
          )}

          {mountedTabs.has('presence') && (
            <div
              className="tab-panel"
              data-active={activeTab === 'presence' ? 'true' : 'false'}
              aria-hidden={activeTab !== 'presence'}
              inert={activeTab !== 'presence' ? true : undefined}
            >
              <Suspense fallback={<TabSkeleton />}>
                <PresenceView
                  key={roomId ?? 'no-zone'}
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
              </Suspense>
            </div>
          )}

          {mountedTabs.has('dms') && (
            <div
              className="tab-panel"
              data-active={activeTab === 'dms' ? 'true' : 'false'}
              data-fill={dmsThreadOpen ? 'true' : undefined}
              aria-hidden={activeTab !== 'dms'}
              inert={activeTab !== 'dms' ? true : undefined}
            >
              <Suspense fallback={<TabSkeleton />}>
                <AnimatePresence mode="wait" initial={false}>
                  {dmPeerId && selfUserId ? (
                    <motion.div
                      key={`dm-${dmPeerId}`}
                      initial={contentSwitch.initial}
                      animate={contentSwitch.animate}
                      exit={contentSwitch.exit}
                      transition={contentSwitch.transition}
                      className="flex min-h-0 flex-1 flex-col"
                    >
                      <DmConversationView
                        selfUserId={selfUserId}
                        peerId={dmPeerId}
                        peerAlias={
                          presence[dmPeerId]?.alias ||
                          cachedPeerVisual(dmPeerId)?.suggestedAlias ||
                          t('presenceNoAlias')
                        }
                        trustStore={trustStore}
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
                    </motion.div>
                  ) : (
                    <motion.div
                      key="dm-list"
                      initial={contentSwitch.initial}
                      animate={contentSwitch.animate}
                      exit={contentSwitch.exit}
                      transition={contentSwitch.transition}
                    >
                      <DmListView
                        selfUserId={selfUserId}
                        presence={presence}
                        onlineUserIds={onlineUserIds}
                        dmMessages={dmMessages}
                        dmUnread={dmUnread}
                        trustStore={trustStore}
                        onGoToRooms={() => selectTab('rooms')}
                        onSelectPeer={(peerId) => {
                          clearDmUnread(peerId);
                          setDmPeerId(peerId);
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Suspense>
            </div>
          )}

          {mountedTabs.has('how') && (
            <div
              className="tab-panel"
              data-active={activeTab === 'how' ? 'true' : 'false'}
              aria-hidden={activeTab !== 'how'}
              inert={activeTab !== 'how' ? true : undefined}
            >
              <Suspense fallback={<TabSkeleton />}>
                <HowItWorksView />
              </Suspense>
            </div>
          )}
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
