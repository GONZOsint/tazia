import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import type { RoomJoinParams, RoomState } from '../../hooks/useRoomManager';
import { useT } from '../../i18n';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { stageSwitch } from '../../motion/tokens';
import { HubEntryPanel } from './entry/HubEntryPanel';
import { JoinedZonesSection } from './entry/JoinedZonesSection';
import { LeaveRoomConfirm } from './entry/LeaveRoomConfirm';
import { RoomEntryHero } from './entry/RoomEntryHero';
import { useRoomEntryChrome } from './entry/useRoomEntryChrome';
import { useZoneLeave } from './entry/useZoneLeave';

interface RoomEntryViewProps {
  initialRoomId?: string;
  initialPhrase?: string | null;
  /** Changes when a new invite is consumed mid-session so Join remounts with autofill. */
  inviteNonce?: number;
  isJoining: boolean;
  errorMsg: string | null;
  /** Expand TURN panel (ICE / peer-connect failures). */
  showIceHint?: boolean;
  activeRoomId?: string | null;
  joinedRooms?: RoomState[];
  onJoinRoom: (params: RoomJoinParams) => Promise<void>;
  onSwitchRoom?: (roomId: string) => void;
  onLeaveRoom?: (roomId: string) => Promise<void>;
}

export function RoomEntryView({
  initialRoomId = '',
  initialPhrase = null,
  inviteNonce = 0,
  isJoining,
  errorMsg,
  showIceHint = false,
  activeRoomId = null,
  joinedRooms = [],
  onJoinRoom,
  onSwitchRoom,
  onLeaveRoom,
}: RoomEntryViewProps) {
  const t = useT();
  const {
    leaveTarget,
    setLeaveTarget,
    leavingId,
    listRooms,
    onExitComplete,
    confirmLeave,
  } = useZoneLeave({ joinedRooms, onLeaveRoom });

  const hasZones = joinedRooms.length > 0 || leavingId !== null;

  const chrome = useRoomEntryChrome({
    initialRoomId,
    initialPhrase,
    inviteNonce,
    errorMsg,
    showIceHint,
    joinedRooms,
    hasZones,
  });

  const formProps = {
    errorMsg,
    showIceHint,
    isJoining,
    onJoinRoom,
    douseKey: chrome.douseKey,
    createFormKey: chrome.createFormKey,
    inviteNonce,
    initialRoomId,
    initialPhrase,
  };

  return (
    <main className="mx-auto max-w-[1280px] space-y-4 px-4 py-3 sm:px-8 sm:py-5 lg:py-6">
      <LayoutGroup id="zone-ignite">
        {chrome.browserBlocked && (
          <AlertBanner tone="error">
            <p className="font-semibold">{t('browserBlockedTitle')}</p>
            <p className="mt-1 font-normal opacity-90">{t('browserBlockedBody')}</p>
            {!chrome.browserSupport.secureContext && (
              <p className="mt-1 font-normal opacity-90">{t('browserHttpsHint')}</p>
            )}
          </AlertBanner>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {!hasZones ? (
            <motion.div
              key="entry-hero"
              initial={chrome.reduceMotion ? false : stageSwitch.initial}
              animate={stageSwitch.animate}
              exit={chrome.reduceMotion ? undefined : stageSwitch.exit}
              transition={stageSwitch.transition}
            >
              <RoomEntryHero
                showHeroStage={chrome.showHeroStage}
                showConfigStage={chrome.showConfigStage}
                entryTab={chrome.entryTab}
                bootMode={chrome.bootMode}
                bootRing={chrome.bootRing}
                skipHeroBootMotion={chrome.skipHeroBootMotion}
                reduceMotion={chrome.reduceMotion}
                browserBlocked={chrome.browserBlocked}
                heroIdleEnabled={chrome.heroIdleEnabled}
                heroIdlePaused={chrome.heroIdlePaused}
                heroCtaNudging={chrome.heroCtaNudging}
                heroRef={chrome.heroRef}
                markRef={chrome.markRef}
                stageTitleRef={chrome.stageTitleRef}
                noteHeroInteraction={chrome.noteHeroInteraction}
                openEntry={chrome.openEntry}
                closeEntry={chrome.closeEntry}
                {...formProps}
              />
            </motion.div>
          ) : (
            <motion.div
              key="entry-hub"
              initial={chrome.reduceMotion ? false : stageSwitch.initial}
              animate={stageSwitch.animate}
              exit={chrome.reduceMotion ? undefined : stageSwitch.exit}
              transition={stageSwitch.transition}
              className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start md:gap-5 lg:gap-6"
            >
              {chrome.showHubZones ? (
                <JoinedZonesSection
                  listRooms={listRooms}
                  joinedRooms={joinedRooms}
                  activeRoomId={activeRoomId}
                  leavingId={leavingId}
                  reduceMotion={chrome.reduceMotion}
                  atCap={chrome.atCap}
                  browserBlocked={chrome.browserBlocked}
                  forgeConfetti={chrome.forgeConfetti}
                  setForgeConfetti={chrome.setForgeConfetti}
                  pulseRoomId={chrome.pulseRoomId}
                  qrRoomId={chrome.qrRoomId}
                  setQrRoomId={chrome.setQrRoomId}
                  seenRoomIdsRef={chrome.seenRoomIdsRef}
                  onLeaveRoom={onLeaveRoom}
                  onSwitchRoom={onSwitchRoom}
                  setLeaveTarget={setLeaveTarget}
                  onExitComplete={onExitComplete}
                  openEntry={chrome.openEntry}
                />
              ) : null}

              {(chrome.mdUp || chrome.showHubEntry) && !chrome.browserBlocked && (
                <HubEntryPanel
                  mdUp={chrome.mdUp}
                  showHubEntry={chrome.showHubEntry}
                  entryTab={chrome.entryTab}
                  atCap={chrome.atCap}
                  reduceMotion={chrome.reduceMotion}
                  hubEntryTitleRef={chrome.hubEntryTitleRef}
                  openEntry={chrome.openEntry}
                  closeEntry={chrome.closeEntry}
                  {...formProps}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!chrome.entryTab && showIceHint && (
          <AlertBanner tone="warning" role="status">
            <button
              type="button"
              className="min-h-[44px] rounded-[var(--radius-ctrl)] text-left underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => chrome.setEntryTab('join')}
            >
              {t('errIceHint')}
            </button>
          </AlertBanner>
        )}

        <LeaveRoomConfirm
          open={leaveTarget !== null}
          onCancel={() => setLeaveTarget(null)}
          onConfirm={() => {
            const id = leaveTarget;
            if (id) chrome.setQrRoomId((cur) => (cur === id ? null : cur));
            confirmLeave();
          }}
        />
      </LayoutGroup>
    </main>
  );
}
