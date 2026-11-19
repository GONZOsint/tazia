import { ArrowLeft, KeyRound, PlusCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { RefObject } from 'react';
import { MAX_ROOMS, type RoomJoinParams } from '../../../hooks/useRoomManager';
import { useT } from '../../../i18n';
import { AccentButton, SecondaryButton } from '../../../components/ui/AccentButton';
import {
  DUR,
  EASE,
  TAP,
  TAP_TRANSITION,
  contentSwitch,
  stageSwitch,
} from '../../../motion/tokens';
import { EntryFormsStack } from './EntryFormsStack';

type HubEntryPanelProps = {
  mdUp: boolean;
  showHubEntry: boolean;
  entryTab: 'create' | 'join' | null;
  atCap: boolean;
  reduceMotion: boolean | null;
  hubEntryTitleRef: RefObject<HTMLHeadingElement>;
  openEntry: (tab: 'create' | 'join') => void;
  closeEntry: () => void;
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

export function HubEntryPanel({
  mdUp,
  showHubEntry,
  entryTab,
  atCap,
  reduceMotion,
  hubEntryTitleRef,
  openEntry,
  closeEntry,
  errorMsg,
  showIceHint,
  isJoining,
  onJoinRoom,
  douseKey,
  createFormKey,
  inviteNonce,
  initialRoomId,
  initialPhrase,
}: HubEntryPanelProps) {
  const t = useT();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.section
        key={showHubEntry ? `entry-hub-${entryTab}` : 'hub-another'}
        initial={
          reduceMotion
            ? { opacity: 0.92 }
            : mdUp
              ? contentSwitch.initial
              : stageSwitch.initial
        }
        animate={
          reduceMotion
            ? { opacity: 1 }
            : mdUp
              ? contentSwitch.animate
              : stageSwitch.animate
        }
        exit={
          reduceMotion
            ? { opacity: 0.92 }
            : mdUp
              ? contentSwitch.exit
              : stageSwitch.exit
        }
        transition={
          reduceMotion
            ? { duration: DUR.micro, ease: EASE.outExpo }
            : mdUp
              ? contentSwitch.transition
              : stageSwitch.transition
        }
        className="panel-surface panel-pad"
        aria-labelledby={showHubEntry ? 'rooms-hub-entry-title' : 'rooms-another-title'}
      >
        {showHubEntry ? (
          <>
            <div className="mb-4 flex items-center gap-2">
              {!mdUp && (
                <motion.button
                  whileTap={TAP}
                  transition={TAP_TRANSITION}
                  type="button"
                  onClick={closeEntry}
                  className="icon-action icon-action--ghost pressable shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
                  aria-label={t('roomsEntryBack')}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </motion.button>
              )}
              <h2
                id="rooms-hub-entry-title"
                ref={hubEntryTitleRef}
                tabIndex={-1}
                className="type-title min-w-0 flex-1 text-ink outline-none"
              >
                {entryTab === 'create' ? t('roomsHeroCreate') : t('roomsHeroJoin')}
              </h2>
              {mdUp && (
                <div
                  role="tablist"
                  aria-label={t('roomsAnotherTitle')}
                  className="inline-flex shrink-0 rounded-[var(--radius-ctrl)] border border-border bg-bg p-0.5"
                >
                  <motion.button
                    whileTap={atCap ? undefined : TAP}
                    transition={TAP_TRANSITION}
                    type="button"
                    role="tab"
                    disabled={atCap}
                    onClick={() => openEntry('create')}
                    aria-selected={entryTab === 'create'}
                    className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[calc(var(--radius-ctrl)-2px)] px-3 type-ui font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${
                      entryTab === 'create'
                        ? 'bg-accent text-on-accent'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('roomsCreate')}
                  </motion.button>
                  <motion.button
                    whileTap={atCap ? undefined : TAP}
                    transition={TAP_TRANSITION}
                    type="button"
                    role="tab"
                    disabled={atCap}
                    onClick={() => openEntry('join')}
                    aria-selected={entryTab === 'join'}
                    className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[calc(var(--radius-ctrl)-2px)] px-3 type-ui font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${
                      entryTab === 'join'
                        ? 'bg-accent text-on-accent'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('roomsJoin')}
                  </motion.button>
                </div>
              )}
            </div>
            <EntryFormsStack
              entryTab={entryTab}
              stacked
              errorMsg={errorMsg}
              showIceHint={showIceHint}
              isJoining={isJoining}
              onJoinRoom={onJoinRoom}
              douseKey={douseKey}
              createFormKey={createFormKey}
              inviteNonce={inviteNonce}
              initialRoomId={initialRoomId}
              initialPhrase={initialPhrase}
            />
          </>
        ) : (
          <div className="flex min-h-[12rem] flex-col justify-center">
            <div className="mb-5">
              <h2 id="rooms-another-title" className="type-title text-ink">
                {t('roomsAnotherTitle')}
              </h2>
              <p className="type-caption mt-0.5">
                {atCap ? t('roomsMaxReached', { n: MAX_ROOMS }) : t('roomsAnotherHint')}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AccentButton
                size="md"
                disabled={atCap}
                onClick={() => openEntry('create')}
                className="w-full"
              >
                <PlusCircle className="h-5 w-5" aria-hidden="true" />
                {t('roomsCreate')}
              </AccentButton>
              <SecondaryButton
                size="md"
                disabled={atCap}
                onClick={() => openEntry('join')}
                className="w-full"
              >
                <KeyRound className="h-5 w-5" aria-hidden="true" />
                {t('roomsJoin')}
              </SecondaryButton>
            </div>
          </div>
        )}
      </motion.section>
    </AnimatePresence>
  );
}
