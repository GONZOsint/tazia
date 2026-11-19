import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, KeyRound, LogOut, PlusCircle, QrCode } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { identiconVisualFromHex } from '../../core/crypto/identity';
import {
  countOtherPeers,
  MAX_ROOMS,
  type RoomJoinParams,
  type RoomState,
} from '../../hooks/useRoomManager';
import { useT } from '../../i18n';
import { Identicon } from '../../components/content/Identicon';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TaziaLogo } from '../../components/brand/TaziaLogo';
import { BurningPhrase } from '../../components/session/BurningPhrase';
import { MeshStatusBadge } from '../../components/session/MeshStatusBadge';
import { probeBrowserSupportSync } from '../../core/utils/browserSupport';
import { ConfettiBurst } from '../../components/ui/ConfettiBurst';
import {
  BURN,
  DUR,
  EASE,
  IGNITE,
  TAP,
  TAP_TRANSITION,
  ZONE_BOOT,
  contentSwitch,
  forgeEnter,
  listRowEnter,
  stageSwitch,
  zoneBootCopy,
  zoneBootMark,
  zoneBootMarkShort,
  zoneBootReduced,
  zoneCardExit,
} from '../../motion/tokens';
import { haptic, HAPTIC_TAP } from '../../motion/haptic';

function readBootSeen(): boolean {
  try {
    return sessionStorage.getItem(ZONE_BOOT.storageKey) === '1';
  } catch {
    return false;
  }
}

function markBootSeen(): void {
  try {
    sessionStorage.setItem(ZONE_BOOT.storageKey, '1');
  } catch {
    /* ignore */
  }
}
import { CreateRoomForm } from './CreateRoomForm';
import { JoinRoomForm } from './JoinRoomForm';
import { TurnRelaySettings } from './TurnRelaySettings';
import { ZoneInvitePanel } from './ZoneInvitePanel';

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
  const hasInvite = Boolean(initialRoomId);
  const hasZones = joinedRooms.length > 0;
  const atCap = joinedRooms.length >= MAX_ROOMS;
  const [entryTab, setEntryTab] = useState<'create' | 'join' | null>(() =>
    hasInvite ? 'join' : hasZones ? null : null
  );
  const [createFormKey, setCreateFormKey] = useState(0);
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [qrRoomId, setQrRoomId] = useState<string | null>(null);
  const [pulseRoomId, setPulseRoomId] = useState<string | null>(null);
  const [forgeConfetti, setForgeConfetti] = useState(false);
  const [douseKey, setDouseKey] = useState(0);
  /** Ids already painted — used so forgeEnter applies on first mount of a new card. */
  const seenRoomIdsRef = useRef<Set<string>>(new Set(joinedRooms.map((r) => r.roomId)));
  const prevErrorRef = useRef<string | null>(null);
  const browserSupport = useMemo(() => probeBrowserSupportSync(), []);
  const browserBlocked = browserSupport.level === 'blocked';
  const reduceMotion = useReducedMotion();
  /**
   * Sticky per hero mount: full = cold start; revisit = session reopen / post-burn;
   * short = invite or reduced-motion. Recomputed when hero remounts (zones cleared).
   */
  const bootModeRef = useRef<'full' | 'revisit' | 'short' | null>(null);
  if (!hasZones && bootModeRef.current === null) {
    bootModeRef.current =
      reduceMotion || hasInvite ? 'short' : readBootSeen() ? 'revisit' : 'full';
  }
  const stageTitleRef = useRef<HTMLHeadingElement>(null);
  /** After hero→configure once, skip ZONE_BOOT replay when returning via Back. */
  const heroBootPlayedRef = useRef(false);
  if (hasZones) {
    bootModeRef.current = null;
    heroBootPlayedRef.current = false;
  }
  const bootMode = bootModeRef.current ?? 'short';
  const [bootRing, setBootRing] = useState(false);
  const bootHapticRef = useRef(false);
  /** Cold start: hero and configure swap in one viewport (no stacked scroll). */
  const stageMode = !hasZones;
  const showHeroStage = stageMode && (!entryTab || browserBlocked);
  const showConfigStage = stageMode && Boolean(entryTab) && !browserBlocked;
  const showHubEntry = hasZones && Boolean(entryTab) && !browserBlocked;
  const skipHeroBootMotion = heroBootPlayedRef.current;

  useEffect(() => {
    if (initialRoomId) setEntryTab('join');
  }, [initialRoomId, initialPhrase, inviteNonce]);

  useEffect(() => {
    if (!showConfigStage || !entryTab) return;
    heroBootPlayedRef.current = true;
    document.getElementById('main-content')?.scrollTo(0, 0);
    const id = window.requestAnimationFrame(() => {
      stageTitleRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [showConfigStage, entryTab]);

  // ZONE_BOOT timeline — CTAs stay interactive; ornament is non-blocking.
  useEffect(() => {
    if (hasZones || !showHeroStage) return;
    // Returning from configure: stageSwitch already covered the handoff.
    if (heroBootPlayedRef.current) {
      markBootSeen();
      setBootRing(false);
      return;
    }
    bootHapticRef.current = false;
    setBootRing(false);

    if (bootMode === 'short' || bootMode === 'revisit') {
      markBootSeen();
      if (!reduceMotion) {
        setBootRing(true);
        const clear = window.setTimeout(() => setBootRing(false), ZONE_BOOT.revisitMs);
        return () => window.clearTimeout(clear);
      }
      return;
    }

    const ringAt = window.setTimeout(() => setBootRing(true), ZONE_BOOT.sparkMs);
    const hapticAt = window.setTimeout(() => {
      if (bootHapticRef.current) return;
      bootHapticRef.current = true;
      haptic(HAPTIC_TAP);
    }, ZONE_BOOT.glowMs);
    const doneAt = window.setTimeout(() => {
      setBootRing(false);
      markBootSeen();
    }, ZONE_BOOT.finishMs);

    return () => {
      window.clearTimeout(ringAt);
      window.clearTimeout(hapticAt);
      window.clearTimeout(doneAt);
    };
  }, [hasZones, showHeroStage, bootMode, reduceMotion, inviteNonce]);

  useEffect(() => {
    if (showIceHint && hasZones) setEntryTab((cur) => cur ?? 'join');
  }, [showIceHint, hasZones]);

  useEffect(() => {
    if (errorMsg && errorMsg !== prevErrorRef.current) {
      setDouseKey((k) => k + 1);
    }
    prevErrorRef.current = errorMsg;
  }, [errorMsg]);

  // After paint: detect new ids (render already used old seen set for forgeEnter).
  useLayoutEffect(() => {
    const nextIds = new Set(joinedRooms.map((r) => r.roomId));
    let newlyJoined: string | null = null;
    for (const id of nextIds) {
      if (!seenRoomIdsRef.current.has(id)) {
        newlyJoined = id;
        break;
      }
    }
    seenRoomIdsRef.current = nextIds;
    if (!newlyJoined) return;
    setEntryTab(null);
    setCreateFormKey((k) => k + 1);
    setPulseRoomId(newlyJoined);
    setForgeConfetti(true);
    haptic(HAPTIC_TAP);
    const t = window.setTimeout(
      () => setPulseRoomId((cur) => (cur === newlyJoined ? null : cur)),
      IGNITE.finishMs
    );
    return () => window.clearTimeout(t);
  }, [joinedRooms]);

  const openEntry = (tab: 'create' | 'join') => {
    if (atCap) return;
    // Hub: same CTA toggles the panel closed. Cold start uses Back instead.
    if (hasZones && entryTab === tab) {
      setEntryTab(null);
      return;
    }
    if (tab === 'create') setCreateFormKey((k) => k + 1);
    setEntryTab(tab);
  };

  const closeEntry = () => {
    haptic(HAPTIC_TAP);
    setEntryTab(null);
  };

  const enterZone = (roomId: string) => {
    onSwitchRoom?.(roomId);
  };

  const entryForms = (
    <>
      {errorMsg && (
        <AlertBanner tone="error" className="mb-4">
          {errorMsg}
        </AlertBanner>
      )}

      {showIceHint && (
        <AlertBanner tone="warning" role="status" className="mb-4">
          {t('errIceHint')}
        </AlertBanner>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {entryTab === 'create' ? (
          <CreateRoomForm
            key={`create-${createFormKey}`}
            isJoining={isJoining}
            onJoinRoom={onJoinRoom}
            douseKey={douseKey}
          />
        ) : (
          <JoinRoomForm
            key={`join-${inviteNonce}-${initialRoomId}`}
            initialRoomId={initialRoomId}
            initialPhrase={initialPhrase}
            isJoining={isJoining}
            onJoinRoom={onJoinRoom}
            douseKey={douseKey}
          />
        )}
      </AnimatePresence>

      <TurnRelaySettings forceOpen={showIceHint} />
    </>
  );

  return (
    <main className="mx-auto max-w-[1280px] space-y-4 px-4 py-3 sm:px-8 sm:py-5 lg:py-6">
      <LayoutGroup id="zone-ignite">
      {browserBlocked && (
        <AlertBanner tone="error">
          <p className="font-semibold">{t('browserBlockedTitle')}</p>
          <p className="mt-1 font-normal opacity-90">{t('browserBlockedBody')}</p>
          {!browserSupport.secureContext && (
            <p className="mt-1 font-normal opacity-90">{t('browserHttpsHint')}</p>
          )}
        </AlertBanner>
      )}

      {!hasZones && (
        <AnimatePresence mode="wait" initial={false}>
          {showHeroStage ? (
            <motion.section
              key="hero-landing"
              initial={reduceMotion ? false : stageSwitch.initial}
              animate={stageSwitch.animate}
              exit={reduceMotion ? { opacity: 0 } : stageSwitch.exit}
              transition={
                reduceMotion
                  ? { duration: DUR.micro, ease: EASE.outExpo }
                  : stageSwitch.transition
              }
              className="hero-landing px-5 py-14 sm:px-10 sm:py-20"
            >
              <div
                className={`hero-glow${bootMode === 'full' && !reduceMotion ? ' zone-boot-glow' : ''}`}
                aria-hidden="true"
              />
              <div className="relative mx-auto flex max-w-md flex-col items-center text-center">
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
                  <TaziaLogo
                    size={88}
                    sharedMark
                    className="hero-landing-mark relative z-[1]"
                  />
                </motion.div>
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
                      reduceMotion || bootMode !== 'full'
                        ? 0
                        : (ZONE_BOOT.glowMs + 60) / 1000,
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
                    onClick={() => {
                      haptic(HAPTIC_TAP);
                      openEntry('create');
                    }}
                    className="hero-cta-primary btn-accent-sheen btn-ring-hover inline-flex items-center justify-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <PlusCircle className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
                    {t('roomsHeroCreate')}
                  </motion.button>
                  <motion.button
                    whileHover={browserBlocked || reduceMotion ? undefined : { y: -1 }}
                    whileTap={browserBlocked ? undefined : TAP}
                    transition={TAP_TRANSITION}
                    type="button"
                    disabled={browserBlocked}
                    onClick={() => {
                      haptic(HAPTIC_TAP);
                      openEntry('join');
                    }}
                    className="hero-cta-secondary inline-flex items-center justify-center gap-2 rounded-[var(--radius-ctrl)] border border-border bg-bg/80 px-4 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <KeyRound className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
                    {t('roomsHeroJoin')}
                  </motion.button>
                </motion.div>
              </div>
            </motion.section>
          ) : showConfigStage ? (
            <motion.section
              key={`entry-stage-${entryTab}`}
              initial={reduceMotion ? { opacity: 0 } : stageSwitch.initial}
              animate={stageSwitch.animate}
              exit={reduceMotion ? { opacity: 0 } : stageSwitch.exit}
              transition={
                reduceMotion
                  ? { duration: DUR.micro, ease: EASE.outExpo }
                  : stageSwitch.transition
              }
              className="panel-surface p-4 sm:p-5"
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
              {entryForms}
            </motion.section>
          ) : null}
        </AnimatePresence>
      )}

      {hasZones && (
        <section className="panel-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="type-title text-ink">
                {t('roomsJoinedTitle')}
              </h2>
              {joinedRooms.length < MAX_ROOMS && (
                <p className="type-caption mt-0.5">{t('roomsActiveHint')}</p>
              )}
            </div>
            <CapacityDots filled={joinedRooms.length} max={MAX_ROOMS} label={t('roomsCapacityAria', { n: joinedRooms.length, max: MAX_ROOMS })} />
          </div>

          <ul className="relative mt-3 space-y-2">
            <ConfettiBurst play={forgeConfetti} onDone={() => setForgeConfetti(false)} />
            <AnimatePresence mode="popLayout" initial={false}>
              {joinedRooms.map((room) => {
                const isActive = room.roomId === activeRoomId;
                const dmUnread = Object.values(room.dmUnread).reduce((a, b) => a + b, 0);
                const showQr = qrRoomId === room.roomId;
                const justBorn = !seenRoomIdsRef.current.has(room.roomId);
                const justJoined = pulseRoomId === room.roomId || justBorn;
                const incinerating = leavingId === room.roomId;
                const enter =
                  justBorn && !reduceMotion ? forgeEnter : listRowEnter;
                const leaveAnimate = reduceMotion
                  ? zoneCardExit.incinerateReduced
                  : zoneCardExit.incinerate;
                const zoneIcon = identiconVisualFromHex(room.roomId);
                return (
                  <motion.li
                    key={room.roomId}
                    layout={!incinerating}
                    layoutDependency={leavingId ?? 'stable'}
                    initial={enter.initial}
                    animate={incinerating ? leaveAnimate : enter.animate}
                    exit={
                      reduceMotion
                        ? zoneCardExit.incinerateReduced
                        : zoneCardExit.exit
                    }
                    data-zone-id={room.roomId}
                    data-zone-card={room.roomId}
                    className={`session-burn-target session-ignite-target relative overflow-hidden rounded-[var(--radius-ctrl)] border ${
                      isActive
                        ? 'border-accent bg-accent-soft ring-1 ring-accent/50'
                        : 'border-border bg-bg'
                    } ${justJoined ? 'zone-join-pulse igniting-front' : ''} ${
                      incinerating ? 'incinerated-collapse pointer-events-none' : ''
                    } ${room.relayFallbackActive ? 'relay-channel-tint' : ''}`}
                    aria-current={isActive ? 'true' : undefined}
                    aria-busy={incinerating || undefined}
                  >
                    {justBorn && !reduceMotion && (
                      <motion.span
                        layoutId={IGNITE.layoutId}
                        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-accent/30"
                        transition={EASE.ritualSpring}
                        aria-hidden="true"
                      />
                    )}
                    <div className="flex items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() => enterZone(room.roomId)}
                        className="pressable flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-3.5"
                        aria-label={
                          isActive
                            ? `${t('roomsGoToChat')}: ${room.roomId}`
                            : `${t('roomsSwitchTo')}: ${room.roomId}`
                        }
                      >
                        <Identicon
                          matrix={zoneIcon.identiconMatrix}
                          size={40}
                          label={room.roomId}
                          fg={zoneIcon.fg}
                          bg={zoneIcon.bg}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[length:var(--type-caption)] font-medium tracking-[0.01em] text-ink">
                            {room.roomId}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <MeshStatusBadge
                              status={room.meshStatus}
                              onlineCount={countOtherPeers(room.onlineUserIds, room.selfUserId)}
                              compact
                              relayActive={room.relayFallbackActive}
                            />
                            {isActive && (
                              <span className="type-badge rounded-full bg-accent px-2 py-0.5 text-on-accent">
                                {t('roomsActiveLabel')}
                              </span>
                            )}
                            {room.unreadCount > 0 && (
                              <span className="type-badge rounded-full bg-accent/90 px-2 py-0.5 text-on-accent">
                                {room.unreadCount > 9 ? '9+' : room.unreadCount}
                              </span>
                            )}
                            {dmUnread > 0 && (
                              <span className="type-badge rounded-full border border-border bg-surface-raised px-2 py-0.5 font-semibold text-muted">
                                {dmUnread > 9 ? '9+' : dmUnread}
                              </span>
                            )}
                          </div>
                          {room.roomError && (
                            <p className="type-caption mt-1 truncate text-danger-ink">
                              {t(room.roomError.key, room.roomError.vars)}
                            </p>
                          )}
                          {!room.roomError && (room.transportNotice || room.relayFallbackActive) && (
                            <p className="type-caption mt-1 truncate text-warn-ink">
                              {t(
                                room.transportNotice?.key ?? 'infoRelayPath',
                                room.transportNotice?.vars
                              )}
                            </p>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrRoomId((cur) => (cur === room.roomId ? null : room.roomId))}
                        aria-pressed={showQr}
                        className={`icon-action pressable shrink-0 self-center focus-visible:outline-2 focus-visible:outline-accent ${
                          showQr ? 'is-active' : 'icon-action--ghost'
                        }`}
                        title={showQr ? t('roomsHideQr') : t('roomsShowQr')}
                        aria-label={showQr ? t('roomsHideQr') : t('roomsShowQr')}
                      >
                        <QrCode className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {onLeaveRoom && (
                        <button
                          type="button"
                          onClick={() => setLeaveTarget(room.roomId)}
                          className="icon-action icon-action--danger pressable shrink-0 self-center focus-visible:outline-2 focus-visible:outline-accent"
                          title={t('roomsLeaveRoom')}
                          aria-label={t('roomsLeaveRoom')}
                        >
                          <LogOut className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <AnimatePresence initial={false}>
                      {showQr && (
                        <ZoneInvitePanel
                          key={`qr-${room.roomId}`}
                          roomId={room.roomId}
                          phrase={room.phrase}
                          compact
                        />
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>

          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink">{t('roomsAnotherTitle')}</h3>
              <p className="type-caption mt-0.5">
                {atCap ? t('roomsMaxReached', { n: MAX_ROOMS }) : t('roomsAnotherHint')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileTap={atCap || browserBlocked ? undefined : TAP}
                transition={TAP_TRANSITION}
                type="button"
                disabled={atCap || browserBlocked}
                onClick={() => openEntry('create')}
                aria-pressed={entryTab === 'create'}
                className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${
                  entryTab === 'create'
                    ? 'bg-accent text-on-accent'
                    : 'border border-border bg-bg text-ink hover:bg-surface'
                }`}
              >
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                {t('roomsCreate')}
              </motion.button>
              <motion.button
                whileTap={atCap || browserBlocked ? undefined : TAP}
                transition={TAP_TRANSITION}
                type="button"
                disabled={atCap || browserBlocked}
                onClick={() => openEntry('join')}
                aria-pressed={entryTab === 'join'}
                className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${
                  entryTab === 'join'
                    ? 'bg-accent text-on-accent'
                    : 'border border-border bg-bg text-ink hover:bg-surface'
                }`}
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                {t('roomsJoin')}
              </motion.button>
            </div>
          </div>
        </section>
      )}

      <AnimatePresence initial={false}>
        {showHubEntry && (
          <motion.section
            key={`entry-hub-${entryTab}`}
            initial={contentSwitch.initial}
            animate={contentSwitch.animate}
            exit={contentSwitch.exit}
            transition={contentSwitch.transition}
            className="panel-surface p-4 sm:p-5"
          >
            {entryForms}
          </motion.section>
        )}
      </AnimatePresence>

      {!entryTab && showIceHint && (
        <AlertBanner tone="warning" role="status">
          <button
            type="button"
            className="min-h-[44px] rounded-[var(--radius-ctrl)] text-left underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => setEntryTab('join')}
          >
            {t('errIceHint')}
          </button>
        </AlertBanner>
      )}

      <ConfirmModal
        open={leaveTarget !== null}
        title={t('leaveRoomConfirmTitle')}
        body={t('leaveRoomConfirmBody')}
        confirmLabel={t('leaveRoomConfirmAction')}
        danger
        onCancel={() => setLeaveTarget(null)}
        onConfirm={() => {
          const id = leaveTarget;
          setLeaveTarget(null);
          if (!id || !onLeaveRoom) return;
          const delayMs = reduceMotion ? BURN.reducedCollapseMs : Math.round(DUR.burn * 1000);
          setLeavingId(id);
          window.setTimeout(() => {
            void onLeaveRoom(id).finally(() => {
              setLeavingId((cur) => (cur === id ? null : cur));
            });
          }, delayMs);
        }}
      />
      </LayoutGroup>
    </main>
  );
}

function CapacityDots({
  filled,
  max,
  label,
}: {
  filled: number;
  max: number;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-1" role="meter" aria-valuenow={filled} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-2 w-2 rounded-full transition-colors duration-[var(--dur-micro)] ${
            i < filled ? 'bg-accent' : 'bg-border'
          }`}
        />
      ))}
    </div>
  );
}
