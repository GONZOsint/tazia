import { useMemo, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Radio } from 'lucide-react';
import { BottomNav } from '../components/layout/BottomNav';
import { TopBar, type ActiveTab } from '../components/layout/TopBar';
import { AlertBanner } from '../components/ui/AlertBanner';
import { ForumWorkspace } from '../features/forum/ForumWorkspace';
import { HowItWorksView } from '../features/how/HowItWorksView';
import { PresenceView } from '../features/presence/PresenceView';
import { IpConsentModal } from '../features/rooms/IpConsentModal';
import { RoomEntryView } from '../features/rooms/RoomEntryView';
import { useTaziaSession } from '../hooks/useTaziaSession';
import { useT } from '../i18n';
import { parseInviteInput, scrubPhraseFromLocationHash } from '../core/utils/inviteLink';

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
  const [activeTab, setActiveTab] = useState<ActiveTab>('rooms');
  const [{ invite: initialInvite, phraseWasScrubbed }] = useState(readInitialInvite);

  const {
    isInRoom,
    roomId,
    phrase,
    profile,
    selfUserId,
    isJoining,
    joinError,
    roomError,
    burnNotice,
    messages,
    presence,
    onlineUserIds,
    isPublishing,
    isSyncing,
    meshStatus,
    rejectedSyncCount,
    ipConsentNeeded,
    confirmIpConsent,
    cancelIpConsent,
    joinRoom,
    burnSession,
    publish,
    syncNow,
  } = useTaziaSession((tab) => setActiveTab(tab));

  const presenceAliases = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, state] of Object.entries(presence)) {
      if (state.alias) map[id] = state.alias;
    }
    return map;
  }, [presence]);

  const joinErrorMsg = joinError ? t(joinError.key, joinError.vars) : null;
  const roomErrorMsg = roomError ? t(roomError.key, roomError.vars) : null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-bg text-ink pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          hasActiveRoom={isInRoom}
          onBurnSession={() => void burnSession()}
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

        <IpConsentModal
          open={ipConsentNeeded}
          onAccept={() => void confirmIpConsent()}
          onCancel={cancelIpConsent}
        />

        {activeTab === 'forum' && isInRoom && roomId && profile && selfUserId ? (
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
            onSyncNow={syncNow}
            onCreateThread={async (title, body) => {
              await publish({
                type: 'NEW_THREAD',
                threadId: crypto.randomUUID(),
                parentMsgId: null,
                title,
                body,
              });
            }}
            onReplyThread={async (threadId, parentMsgId, body) => {
              await publish({
                type: 'REPLY',
                threadId,
                parentMsgId,
                title: '',
                body,
              });
            }}
          />
        ) : activeTab === 'forum' && !isInRoom ? (
          <main className="mx-auto max-w-[560px] px-4 py-16 text-center sm:px-8">
            <Radio className="mx-auto h-8 w-8 text-faint" aria-hidden="true" />
            <h1 className="mt-4 font-display text-xl font-semibold text-ink">
              {t('forumEmptyTitle')}
            </h1>
            <p className="mt-2 text-sm text-muted">{t('forumEmptyBody')}</p>
            <button
              type="button"
              onClick={() => setActiveTab('rooms')}
              className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent"
            >
              {t('forumEmptyCta')}
            </button>
          </main>
        ) : activeTab === 'rooms' ? (
          <RoomEntryView
            initialRoomId={initialInvite?.roomId}
            initialPhrase={initialInvite?.phrase}
            phraseWasScrubbed={phraseWasScrubbed}
            isJoining={isJoining}
            errorMsg={joinErrorMsg}
            activeRoomId={roomId}
            onGoToForum={() => setActiveTab('forum')}
            onBurnSession={() => void burnSession()}
            onJoinRoom={joinRoom}
          />
        ) : activeTab === 'presence' ? (
          <PresenceView
            selfUserId={selfUserId}
            presence={presence}
            onlineUserIds={onlineUserIds}
            meshStatus={meshStatus}
            rejectedSyncCount={rejectedSyncCount}
            onSyncNow={syncNow}
            isSyncing={isSyncing}
          />
        ) : (
          <HowItWorksView />
        )}

        <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />
      </div>
    </MotionConfig>
  );
}
