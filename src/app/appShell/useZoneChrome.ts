import { useCallback, useEffect, useRef, useState } from 'react';
import { IGNITE } from '../../motion/tokens';
import { haptic, HAPTIC_TAP } from '../../motion/haptic';

export function useZoneChrome(
  activeRoomId: string | null,
  setDmPeerId: (id: string | null) => void
) {
  const [igniteRoomId, setIgniteRoomId] = useState<string | null>(null);
  const [zoneSwitchPulse, setZoneSwitchPulse] = useState(false);
  const skipNextZoneSwitchPulseRef = useRef(false);
  const igniteTimerRef = useRef<number | null>(null);
  const prevActiveRoomIdRef = useRef<string | null>(null);

  const handleZoneIgnited = useCallback((roomId: string) => {
    skipNextZoneSwitchPulseRef.current = true;
    setIgniteRoomId(roomId);
    if (igniteTimerRef.current !== null) window.clearTimeout(igniteTimerRef.current);
    igniteTimerRef.current = window.setTimeout(() => {
      setIgniteRoomId((cur) => (cur === roomId ? null : cur));
      igniteTimerRef.current = null;
    }, IGNITE.finishMs);
  }, []);

  useEffect(() => {
    if (prevActiveRoomIdRef.current === activeRoomId) return;
    const prev = prevActiveRoomIdRef.current;
    prevActiveRoomIdRef.current = activeRoomId;
    setDmPeerId(null);
    if (!activeRoomId || prev === null) return;
    if (skipNextZoneSwitchPulseRef.current) {
      skipNextZoneSwitchPulseRef.current = false;
      return;
    }
    setZoneSwitchPulse(true);
    haptic(HAPTIC_TAP);
    const timer = window.setTimeout(() => setZoneSwitchPulse(false), IGNITE.finishMs);
    return () => window.clearTimeout(timer);
  }, [activeRoomId, setDmPeerId]);

  useEffect(() => {
    return () => {
      if (igniteTimerRef.current !== null) window.clearTimeout(igniteTimerRef.current);
    };
  }, []);

  return {
    igniteRoomId,
    zoneSwitchPulse,
    handleZoneIgnited,
  };
}
