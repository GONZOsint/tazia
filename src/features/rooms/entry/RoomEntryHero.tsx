import { ArrowLeft, KeyRound, PlusCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { Ref, RefObject } from 'react';
import { useT } from '../../../i18n';
import { TaziaLogo } from '../../../components/brand/TaziaLogo';
import { BurningPhrase } from '../../../components/session/BurningPhrase';
import {
  DUR,
  EASE,
  TAP,
  TAP_TRANSITION,
  ZONE_BOOT,
  stageSwitch,
  zoneBootCopy,
  zoneBootMark,
  zoneBootMarkShort,
  zoneBootReduced,
} from '../../../motion/tokens';
import { haptic, HAPTIC_TAP } from '../../../motion/haptic';
import { EntryFormsStack } from './EntryFormsStack';
import type { RoomJoinParams } from '../../../hooks/useRoomManager';

type RoomEntryHeroProps = {
  showHeroStage: boolean;
  showConfigStage: boolean;
  entryTab: 'create' | 'join' | null;
  bootMode: 'full' | 'revisit' | 'short';
  bootRing: boolean;
  skipHeroBootMotion: boolean;
  reduceMotion: boolean | null;
  browserBlocked: boolean;
  heroIdleEnabled: boolean;
  heroIdlePaused: boolean;
  heroCtaNudging: boolean;
  heroRef: Ref<HTMLElement>;
  markRef: RefObject<HTMLDivElement | null>;
  stageTitleRef: RefObject<HTMLHeadingElement>;
  noteHeroInteraction: () => void;
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

export function RoomEntryHero({
  showHeroStage,
  showConfigStage,
  entryTab,
  bootMode,
  bootRing,
  skipHeroBootMotion,
  reduceMotion,
  browserBlocked,
  heroIdleEnabled,
  heroIdlePaused,
  heroCtaNudging,
  heroRef,
  markRef,
  stageTitleRef,
  noteHeroInteraction,
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
}: RoomEntryHeroProps) {
  const t = useT();

  return (
    <AnimatePresence mode="wait" initial={false}>
      {showHeroStage ? (
        <motion.section
          key="hero-landing"
          ref={heroRef}
          initial={reduceMotion ? false : stageSwitch.initial}
          animate={stageSwitch.animate}
          exit={reduceMotion ? { opacity: 0.92 } : stageSwitch.exit}
          transition={
            reduceMotion
              ? { duration: DUR.micro, ease: EASE.outExpo }
              : stageSwitch.transition
          }
          onPointerDownCapture={heroIdleEnabled ? noteHeroInteraction : undefined}
          className={`hero-landing px-5 py-14 sm:px-10 sm:py-20${
            heroIdleEnabled ? ' hero-landing--alive' : ''
          }${heroIdleEnabled && heroIdlePaused ? ' hero-landing--paused' : ''}`}
        >
          <div
            className={`hero-glow${bootMode === 'full' && !reduceMotion ? ' zone-boot-glow' : ''}`}
            aria-hidden="true"
          />
          <div className="hero-landing__grid" aria-hidden="true" />
          <div className="relative z-[1] mx-auto flex max-w-md flex-col items-center text-center">
            <div ref={markRef} className="hero-landing-mark-parallax">
              <motion.div
                initial={
                  skipHeroBootMotion
                    ? false
                    : reduceMotion
                      ? zoneBootReduced.initial
                      : bootMode === 'full'
                        ? zoneBootMark.initial
                        : zoneBootMarkShort.initial
                }
                animate={
                  reduceMotion
                    ? zoneBootReduced.animate
                    : bootMode === 'full'
                      ? zoneBootMark.animate
                      : zoneBootMarkShort.animate
                }
                transition={
                  reduceMotion
                    ? zoneBootReduced.transition
                    : bootMode === 'full'
                      ? zoneBootMark.transition
                      : zoneBootMarkShort.transition
                }
                whileHover={reduceMotion || browserBlocked ? undefined : { scale: 1.04 }}
                className={`hero-landing-mark-wrap${bootRing ? ' zone-boot-mark-ring' : ''}`}
              >
                {/*
                  No sharedMark here: layoutId orphan on hero→configure exit
                  caused logo flicker. Handoff to TopBar runs when a zone is active.
                */}
                <TaziaLogo size={88} className="hero-landing-mark relative z-[1]" />
              </motion.div>
            </div>
            <motion.h1
              initial={
                skipHeroBootMotion
                  ? false
                  : reduceMotion
                    ? zoneBootReduced.initial
                    : zoneBootCopy.initial
              }
              animate={reduceMotion ? zoneBootReduced.animate : zoneBootCopy.animate}
              transition={{
                ...(reduceMotion ? zoneBootReduced.transition : zoneBootCopy.transition),
                delay: reduceMotion || bootMode !== 'full' ? 0 : ZONE_BOOT.sparkMs / 1000,
              }}
              className="type-display mt-6 text-ink"
            >
              {t('brand')}
            </motion.h1>
            <motion.p
              initial={
                skipHeroBootMotion
                  ? false
                  : reduceMotion
                    ? zoneBootReduced.initial
                    : zoneBootCopy.initial
              }
              animate={reduceMotion ? zoneBootReduced.animate : zoneBootCopy.animate}
              transition={{
                ...(reduceMotion ? zoneBootReduced.transition : zoneBootCopy.transition),
                delay: reduceMotion || bootMode !== 'full' ? 0 : ZONE_BOOT.glowMs / 1000,
              }}
              className="type-subtitle mt-2.5 text-ink"
            >
              {t('roomsHeroTitle')}
            </motion.p>
            <motion.p
              initial={
                skipHeroBootMotion
                  ? false
                  : reduceMotion
                    ? zoneBootReduced.initial
                    : zoneBootCopy.initial
              }
              animate={reduceMotion ? zoneBootReduced.animate : zoneBootCopy.animate}
              transition={{
                ...(reduceMotion ? zoneBootReduced.transition : zoneBootCopy.transition),
                delay:
                  reduceMotion || bootMode !== 'full' ? 0 : (ZONE_BOOT.glowMs + 60) / 1000,
              }}
              className="type-lede mt-3 max-w-sm text-balance"
            >
              {t('roomsHeroBodyLead')}
              <BurningPhrase>{t('roomsHeroBodyBurn')}</BurningPhrase>
            </motion.p>

            <motion.div
              initial={
                skipHeroBootMotion
                  ? false
                  : reduceMotion
                    ? zoneBootReduced.initial
                    : zoneBootCopy.initial
              }
              animate={reduceMotion ? zoneBootReduced.animate : zoneBootCopy.animate}
              transition={{
                ...(reduceMotion ? zoneBootReduced.transition : zoneBootCopy.transition),
                delay: reduceMotion || bootMode !== 'full' ? 0 : ZONE_BOOT.ctaAtMs / 1000,
              }}
              className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <motion.button
                whileHover={browserBlocked || reduceMotion ? undefined : { y: -1 }}
                whileTap={browserBlocked ? undefined : TAP}
                transition={TAP_TRANSITION}
                type="button"
                disabled={browserBlocked}
                onFocus={heroIdleEnabled ? noteHeroInteraction : undefined}
                onClick={() => {
                  noteHeroInteraction();
                  haptic(HAPTIC_TAP);
                  openEntry('create');
                }}
                className={`hero-cta-primary btn-accent-sheen btn-ring-hover inline-flex items-center justify-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50${
                  heroCtaNudging ? ' is-nudging' : ''
                }`}
              >
                {heroIdleEnabled ? (
                  <span className="hero-cta-sheen-idle" aria-hidden="true" />
                ) : null}
                <PlusCircle
                  className="hero-cta-icon hero-cta-icon--plus h-5 w-5"
                  aria-hidden="true"
                  strokeWidth={1.75}
                />
                {t('roomsHeroCreate')}
              </motion.button>
              <motion.button
                whileHover={browserBlocked || reduceMotion ? undefined : { y: -1 }}
                whileTap={browserBlocked ? undefined : TAP}
                transition={TAP_TRANSITION}
                type="button"
                disabled={browserBlocked}
                onFocus={heroIdleEnabled ? noteHeroInteraction : undefined}
                onClick={() => {
                  noteHeroInteraction();
                  haptic(HAPTIC_TAP);
                  openEntry('join');
                }}
                className="hero-cta-secondary inline-flex items-center justify-center gap-2 rounded-[var(--radius-ctrl)] border border-border bg-bg/80 px-4 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <KeyRound
                  className="hero-cta-icon hero-cta-icon--key h-5 w-5"
                  aria-hidden="true"
                  strokeWidth={1.75}
                />
                {t('roomsHeroJoin')}
              </motion.button>
            </motion.div>

            <motion.div
              initial={
                skipHeroBootMotion
                  ? false
                  : reduceMotion
                    ? zoneBootReduced.initial
                    : zoneBootCopy.initial
              }
              animate={reduceMotion ? zoneBootReduced.animate : zoneBootCopy.animate}
              transition={{
                ...(reduceMotion ? zoneBootReduced.transition : zoneBootCopy.transition),
                delay: reduceMotion || bootMode !== 'full' ? 0 : (ZONE_BOOT.ctaAtMs + 80) / 1000,
              }}
              className="hero-meta"
            >
              <span className="hero-meta__item">
                <span className="hero-meta__dot" aria-hidden="true" />
                {t('roomsHeroMetaP2p')}
              </span>
              <span className="hero-meta__item">
                <span className="hero-meta__dot" aria-hidden="true" />
                {t('roomsHeroMetaEphemeral')}
              </span>
            </motion.div>
          </div>
        </motion.section>
      ) : showConfigStage ? (
        <motion.section
          key={`entry-stage-${entryTab}`}
          initial={reduceMotion ? { opacity: 0.92 } : stageSwitch.initial}
          animate={stageSwitch.animate}
          exit={reduceMotion ? { opacity: 0.92 } : stageSwitch.exit}
          transition={
            reduceMotion
              ? { duration: DUR.micro, ease: EASE.outExpo }
              : stageSwitch.transition
          }
          className="panel-surface panel-pad mx-auto w-full max-w-3xl md:max-w-4xl"
          aria-labelledby="rooms-entry-stage-title"
        >
          <div className="mb-4 flex items-center gap-2">
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
            <h2
              id="rooms-entry-stage-title"
              ref={stageTitleRef}
              tabIndex={-1}
              className="type-title min-w-0 flex-1 text-ink outline-none"
            >
              {entryTab === 'create' ? t('roomsHeroCreate') : t('roomsHeroJoin')}
            </h2>
          </div>
          <EntryFormsStack
            entryTab={entryTab}
            stacked={false}
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
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
