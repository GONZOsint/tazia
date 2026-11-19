import { useCallback, useMemo, useState } from 'react';
import { haptic, HAPTIC_RITUAL } from '../../motion/haptic';

export function useAppModals(burnSession: () => Promise<void>, ipConsentNeeded: boolean) {
  const [burnConfirmOpen, setBurnConfirmOpen] = useState(false);
  const [burnPlaying, setBurnPlaying] = useState(false);

  const modalOpen = useMemo(
    () => ipConsentNeeded || burnConfirmOpen || burnPlaying,
    [ipConsentNeeded, burnConfirmOpen, burnPlaying]
  );

  const finishBurnChoreography = useCallback(() => {
    // Keep burnPlaying true through teardown/reload so the overlay veil
    // never unmounts (that snap-back was the session flicker).
    void burnSession();
  }, [burnSession]);

  const openBurnConfirm = useCallback(() => setBurnConfirmOpen(true), []);
  const cancelBurnConfirm = useCallback(() => setBurnConfirmOpen(false), []);

  const confirmBurn = useCallback(() => {
    setBurnConfirmOpen(false);
    haptic(HAPTIC_RITUAL);
    setBurnPlaying(true);
  }, []);

  return {
    burnConfirmOpen,
    burnPlaying,
    modalOpen,
    finishBurnChoreography,
    openBurnConfirm,
    cancelBurnConfirm,
    confirmBurn,
  };
}
