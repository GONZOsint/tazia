import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useReducedMotion } from 'motion/react';
import { MAX_ROOMS, type RoomState } from '../../../hooks/useRoomManager';
import { useMdUp } from '../../../hooks/useMdUp';
import { useHeroIdlePresence } from '../../../hooks/useHeroIdlePresence';
import { probeBrowserSupportSync } from '../../../core/utils/browserSupport';
import { IGNITE, ZONE_BOOT } from '../../../motion/tokens';
import { haptic, HAPTIC_TAP } from '../../../motion/haptic';
import { markBootSeen, readBootSeen } from './bootStorage';

type ChromeOpts = {
  initialRoomId: string;
  initialPhrase: string | null;
  inviteNonce: number;
  errorMsg: string | null;
  showIceHint: boolean;
  joinedRooms: RoomState[];
  hasZones: boolean;
};

export function useRoomEntryChrome({
  initialRoomId,
  initialPhrase,
  inviteNonce,
  errorMsg,
  showIceHint,
  joinedRooms,
  hasZones,
}: ChromeOpts) {
  const mdUp = useMdUp();
  const hasInvite = Boolean(initialRoomId);
  const atCap = joinedRooms.length >= MAX_ROOMS;
  const [entryTab, setEntryTab] = useState<'create' | 'join' | null>(() =>
    hasInvite ? 'join' : null
  );
  const [createFormKey, setCreateFormKey] = useState(0);
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
  const hubEntryTitleRef = useRef<HTMLHeadingElement>(null);
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
  /** Hub: mobile swaps zones↔entry; desktop keeps both side by side. */
  const showHubEntry = hasZones && Boolean(entryTab) && !browserBlocked;
  const showHubZones = hasZones && (mdUp || !entryTab || browserBlocked);
  const skipHeroBootMotion = heroBootPlayedRef.current;
  const heroIdleEnabled = Boolean(showHeroStage && !reduceMotion && !browserBlocked);
  const {
    heroRef,
    markRef,
    paused: heroIdlePaused,
    nudging: heroCtaNudging,
    noteInteraction: noteHeroInteraction,
  } = useHeroIdlePresence(heroIdleEnabled);

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

  useEffect(() => {
    if (!showHubEntry || !entryTab) return;
    document.getElementById('main-content')?.scrollTo(0, 0);
    if (mdUp) return;
    const id = window.requestAnimationFrame(() => {
      hubEntryTitleRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [showHubEntry, entryTab, mdUp]);

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
    const onOpenFix = () => setEntryTab('join');
    window.addEventListener('tazia:open-fix', onOpenFix);
    return () => window.removeEventListener('tazia:open-fix', onOpenFix);
  }, []);

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
    haptic(HAPTIC_TAP);
    // Let form/hero exit settle before forge confetti so the handoff isn’t abrupt.
    const confettiTimer = window.setTimeout(() => setForgeConfetti(true), 280);
    const timer = window.setTimeout(
      () => setPulseRoomId((cur) => (cur === newlyJoined ? null : cur)),
      IGNITE.finishMs
    );
    return () => {
      window.clearTimeout(confettiTimer);
      window.clearTimeout(timer);
    };
  }, [joinedRooms]);

  const openEntry = (tab: 'create' | 'join') => {
    if (atCap) return;
    haptic(HAPTIC_TAP);
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

  return {
    mdUp,
    atCap,
    entryTab,
    setEntryTab,
    createFormKey,
    qrRoomId,
    setQrRoomId,
    pulseRoomId,
    forgeConfetti,
    setForgeConfetti,
    douseKey,
    seenRoomIdsRef,
    browserSupport,
    browserBlocked,
    reduceMotion,
    bootMode,
    bootRing,
    stageTitleRef: stageTitleRef as RefObject<HTMLHeadingElement>,
    hubEntryTitleRef: hubEntryTitleRef as RefObject<HTMLHeadingElement>,
    showHeroStage,
    showConfigStage,
    showHubEntry,
    showHubZones,
    skipHeroBootMotion,
    heroIdleEnabled,
    heroRef,
    markRef,
    heroIdlePaused,
    heroCtaNudging,
    noteHeroInteraction,
    openEntry,
    closeEntry,
  };
}
