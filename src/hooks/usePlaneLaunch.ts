import { useCallback, useRef, useState } from 'react';
import { DUR } from '../motion/tokens';

/** Shared send affordance: plane launch window then spinner if still busy. */
export function usePlaneLaunch() {
  const [planeKey, setPlaneKey] = useState(0);
  const [launching, setLaunching] = useState(false);
  const timerRef = useRef<number | null>(null);

  const trigger = useCallback(() => {
    setPlaneKey((k) => k + 1);
    setLaunching(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setLaunching(false);
      timerRef.current = null;
    }, DUR.plane * 1000);
  }, []);

  return { planeKey, launching, trigger };
}
