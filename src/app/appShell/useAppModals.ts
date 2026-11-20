import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { haptic, HAPTIC_RITUAL } from '../../motion/haptic';
import { BURN } from '../../motion/tokens';

export function useAppModals(
  burnSession: () => Promise<void>,
  ipConsentNeeded: boolean,
  /** Sync gate so joins abort in the same tick as confirm (before burnPlaying effect). */
  onBurnStart?: () => void
) {
  const [burnConfirmOpen, setBurnConfirmOpen] = useState(false);
  const [burnPlaying, setBurnPlaying] = useState(false);
  const burnTimerRef = useRef<number | null>(null);
  const burnCommittedRef = useRef(false);
  const burnStartedRef = useRef(false);
  const burnSessionRef = useRef(burnSession);
  burnSessionRef.current = burnSession;
  const onBurnStartRef = useRef(onBurnStart);
  onBurnStartRef.current = onBurnStart;

  const startBurnOnce = useCallback(() => {
    if (burnStartedRef.current) return;
    burnStartedRef.current = true;
    void burnSessionRef.current();
  }, []);

  const modalOpen = useMemo(
    () => ipConsentNeeded || burnConfirmOpen || burnPlaying,
    [ipConsentNeeded, burnConfirmOpen, burnPlaying]
  );

  const openBurnConfirm = useCallback(() => {
    if (burnCommittedRef.current || burnPlaying) return;
    setBurnConfirmOpen(true);
  }, [burnPlaying]);
  const cancelBurnConfirm = useCallback(() => setBurnConfirmOpen(false), []);

  const confirmBurn = useCallback(() => {
    if (burnCommittedRef.current) return;
    burnCommittedRef.current = true;
    setBurnConfirmOpen(false);
    onBurnStartRef.current?.();
    haptic(HAPTIC_RITUAL);
    setBurnPlaying(true);
  }, []);

  // Session leave: TopBar WebGL flame dies, then reload.
  useEffect(() => {
    if (!burnPlaying) return;
    burnTimerRef.current = window.setTimeout(() => {
      burnTimerRef.current = null;
      startBurnOnce();
    }, BURN.ignitionMs);
    return () => {
      if (burnTimerRef.current !== null) {
        window.clearTimeout(burnTimerRef.current);
        burnTimerRef.current = null;
        // Confirmed burn must still run if effect tears down early (HMR / remount).
        if (burnCommittedRef.current) startBurnOnce();
      }
    };
  }, [burnPlaying, startBurnOnce]);

  return {
    burnConfirmOpen,
    burnPlaying,
    modalOpen,
    openBurnConfirm,
    cancelBurnConfirm,
    confirmBurn,
  };
}
