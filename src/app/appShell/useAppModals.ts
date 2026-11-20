import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { haptic, HAPTIC_RITUAL } from '../../motion/haptic';

/** Let FireBurnButton WebGL extinguish before session teardown/reload. */
const FIRE_BTN_EXTINGUISH_MS = 720;

export function useAppModals(burnSession: () => Promise<void>, ipConsentNeeded: boolean) {
  const [burnConfirmOpen, setBurnConfirmOpen] = useState(false);
  const [burnPlaying, setBurnPlaying] = useState(false);
  const burnTimerRef = useRef<number | null>(null);

  const modalOpen = useMemo(
    () => ipConsentNeeded || burnConfirmOpen || burnPlaying,
    [ipConsentNeeded, burnConfirmOpen, burnPlaying]
  );

  const openBurnConfirm = useCallback(() => setBurnConfirmOpen(true), []);
  const cancelBurnConfirm = useCallback(() => setBurnConfirmOpen(false), []);

  const confirmBurn = useCallback(() => {
    setBurnConfirmOpen(false);
    haptic(HAPTIC_RITUAL);
    setBurnPlaying(true);
  }, []);

  // No full-app BurnFireOverlay — only the TopBar fire button dies, then reload.
  useEffect(() => {
    if (!burnPlaying) return;
    burnTimerRef.current = window.setTimeout(() => {
      burnTimerRef.current = null;
      void burnSession();
    }, FIRE_BTN_EXTINGUISH_MS);
    return () => {
      if (burnTimerRef.current !== null) {
        window.clearTimeout(burnTimerRef.current);
        burnTimerRef.current = null;
      }
    };
  }, [burnPlaying, burnSession]);

  return {
    burnConfirmOpen,
    burnPlaying,
    modalOpen,
    openBurnConfirm,
    cancelBurnConfirm,
    confirmBurn,
  };
}
