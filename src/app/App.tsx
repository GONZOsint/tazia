import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Loader2, Radio } from 'lucide-react';
import { useSwipeTabs } from '../hooks/useSwipeTabs';
import { BottomNav } from '../components/layout/BottomNav';
import { TopBar, type ActiveTab } from '../components/layout/TopBar';
import { AlertBanner } from '../components/ui/AlertBanner';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useToast } from '../components/ui/ToastHost';
import { KeyChangeAlert } from '../components/session/KeyChangeAlert';
import { IpConsentModal } from '../features/rooms/IpConsentModal';
import { RoomEntryView } from '../features/rooms/RoomEntryView';
import { useRoomManager } from '../hooks/useRoomManager';
import { useT } from '../i18n';
import { parseInviteInput, scrubPhraseFromLocationHash } from '../core/utils/inviteLink';

const ForumWorkspace = lazy(() => import('../features/forum/ForumWorkspace'));
const HowItWorksView = lazy(() => import('../features/how/HowItWorksView'));
const PresenceView = lazy(() => import('../features/presence/PresenceView'));
const DmListView = lazy(() => import('../features/dms/DmListView'));
const DmConversationView = lazy(() => import('../features/dms/DmConversationView'));

function TabSkeleton() {
  return (
    <div className="mx-auto flex max-w-[1280px] items-center justify-center px-4 py-16">
      <Loader2 className="h-6 w-6 animate-spin text-faint" />
    </div>
  );
}

function readInitialInvite() {
  const parsed = parseInviteInput(window.location.hash);
  let phraseWasScrubbed = false;
  if (parsed?.phrase) {
    scrubPhraseFromLocationHash(parsed.roomId);
    phraseWasScrubbed = true;
  }
  return { invite: parsed, phraseWasScrubbed };
}

export default function App() {
  const t = useT();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('rooms');
  const [{ invite: initialInvite, phraseWasScrubbed }] = useState(readInitialInvite);
  const forumTabFocusedRef = useRef(false);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [burnConfirmOpen, setBurnConfirmOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

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
  } = useRoomManager((tab) => setActiveTab(tab as ActiveTab), { forumTabFocusedRef });

  const [dmPeerId, setDmPeerId] = useState<string | null>(null);

  useEffect(() => {
    forumTabFocusedRef.current = activeTab === 'forum';
    if (activeTab === 'forum') clearForumUnread();
  }, [activeTab, clearForumUnread]);

  useEffect(() => {
    setModalOpen(ipConsentNeeded || burnConfirmOpen);
  }, [ipConsentNeeded, burnConfirmOpen]);

  const selectTab = (tab: ActiveTab) => {
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
  const transportNoticeMsg = transportNotice
    ? t(transportNotice.key, transportNotice.vars)
    : null;
  const iceFailed =
    joinError?.key === 'errPeerConnect' ||
    joinError?.key === 'errLocalNetworkDenied' ||
    roomError?.key === 'errPeerConnect' ||
    roomError?.key === 'errLocalNetworkDenied' ||
    !!transportNotice;
  const mainRef = useRef<HTMLDivElement>(null);

  const TABS = ['rooms', 'forum', 'presence', 'dms', 'how'] as const;
  useSwipeTabs(mainRef, {
    tabs: TABS,
    activeTab: activeTab as (typeof TABS)[number],
    onSwipe: (tab) => selectTab(tab as ActiveTab),
    disabled: modalOpen,
  });

  const roomList = [...rooms.values()];

  const tabClass = (id: ActiveTab) =>
    activeTab === id ? 'block' : 'hidden';

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={mainRef}
        className="min-h-screen bg-bg text-ink pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0"
      >
        <TopBar
          activeTab={activeTab}
          onSelectTab={selectTab}
          hasActiveRoom={isInRoom}
          forumUnread={totalForumUnread}
          dmUnread={totalDmUnread}
          onBurnSession={() => setBurnConfirmOpen(true)}
        />

        <AnimatePresence>
          {burnNotice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mx-auto mt-4 flex max-w-[1280px] items-center px-4 sm:px-8"
            >
              <AlertBanner tone="success" role="status" className="w-full">
                {t('burnNotice')}
              </AlertBanner>
            </motion.div>
          )}
        </AnimatePresence>

        {iceFailed && activeTab !== 'rooms' && (
          <div className="mx-auto mt-4 max-w-[1280px] px-4 sm:px-8">
            <AlertBanner tone="warning" role="status" className="w-full">
              <button
                type="button"
                className="text-left underline-offset-2 hover:underline"
                onClick={() => selectTab('rooms')}
              >
                {transportNoticeMsg || t('errIceHint')}
              </button>
            </AlertBanner>
          </div>
        )}

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
          onCancel={() => setBurnConfirmOpen(false)}
          onConfirm={() => {
            setBurnConfirmOpen(false);
            void burnSession();
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
                onDisconnect={() => setBurnConfirmOpen(true)}
                onDismiss={() => dismissKeyChange(activeRoomId, alert.userId)}
              />
            ))}
          </div>
        )}

        <div ref={mainContentRef} id="main-content" tabIndex={-1} className="outline-none">
          <Suspense fallback={<TabSkeleton />}>
            <div className={tabClass('forum')}>
              {isInRoom && roomId && profile && selfUserId ? (
                <ForumWorkspace
                  roomId={roomId}
                  phrase={phrase}
                  profile={profile}
                  selfUserId={selfUserId}
                  messages={messages}
                  presenceAliases={presenceAliases}
                  onlineCount={onlineUserIds.length}
                  meshStatus={meshStatus}
                  isPublishing={isPublishing}
                  isSyncing={isSyncing}
                  roomError={roomErrorMsg}
                  roomErrorTone="error"
                  transportNotice={transportNoticeMsg}
                  onDismissRoomError={dismissRoomError}
                  onDismissTransportNotice={dismissTransportNotice}
                  onSyncNow={async () => {
                    await syncNow();
                    toast.push(t('toastSynced'), 'success');
                  }}
                  onCreateThread={async (title, body) => {
                    const ok = await publish({
                      type: 'NEW_THREAD',
                      threadId: crypto.randomUUID(),
                      parentMsgId: null,
                      title,
                      body,
                    });
                    toast.push(ok ? t('toastPublished') : t('toastPublishFailed'), ok ? 'success' : 'error');
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
                    toast.push(ok ? t('toastPublished') : t('toastPublishFailed'), ok ? 'success' : 'error');
                    return ok;
                  }}
                />
              ) : (
                <main className="mx-auto max-w-[560px] px-4 py-16 text-center sm:px-8">
                  <Radio className="mx-auto h-8 w-8 text-faint" aria-hidden="true" />
                  <h1 className="mt-4 font-display text-xl font-semibold text-ink">
                    {t('forumEmptyTitle')}
                  </h1>
                  <p className="mt-2 text-sm text-muted">{t('forumEmptyBody')}</p>
                  <button
                    type="button"
                    onClick={() => selectTab('rooms')}
                    className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent"
                  >
                    {t('forumEmptyCta')}
                  </button>
                </main>
              )}
            </div>

            <div className={tabClass('rooms')}>
              <RoomEntryView
                initialRoomId={initialInvite?.roomId}
                initialPhrase={initialInvite?.phrase}
                phraseWasScrubbed={phraseWasScrubbed}
                isJoining={isJoining}
                errorMsg={joinErrorMsg}
                showIceHint={iceFailed}
                activeRoomId={roomId}
                joinedRooms={roomList}
                onGoToForum={() => selectTab('forum')}
                onJoinRoom={joinRoom}
                onSwitchRoom={switchRoom}
                onLeaveRoom={leaveRoom}
              />
            </div>

            <div className={tabClass('presence')}>
              <PresenceView
                selfUserId={selfUserId}
                selfSignPubKeyB64={selfSignPubKeyB64}
                trustStore={trustStore}
                presence={presence}
                onlineUserIds={onlineUserIds}
                meshStatus={meshStatus}
                rejectedSyncCount={rejectedSyncCount}
                onSyncNow={syncNow}
                isSyncing={isSyncing}
                onGoToRooms={() => selectTab('rooms')}
              />
            </div>

            <div className={tabClass('dms')}>
              {dmPeerId && selfUserId ? (
                <DmConversationView
                  selfUserId={selfUserId}
                  peerId={dmPeerId}
                  peerAlias={presence[dmPeerId]?.alias || dmPeerId}
                  messages={dmMessages[dmPeerId] ?? []}
                  onSend={async (body) => {
                    const ok = await sendDm(dmPeerId, body);
                    toast.push(ok ? t('toastDmSent') : t('toastDmFailed'), ok ? 'success' : 'error');
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
              )}
            </div>

            <div className={tabClass('how')}>
              <HowItWorksView />
            </div>
          </Suspense>
        </div>

        <BottomNav
          activeTab={activeTab}
          onSelectTab={selectTab}
          forumUnread={totalForumUnread}
          dmUnread={totalDmUnread}
        />
      </div>
    </MotionConfig>
  );
}
