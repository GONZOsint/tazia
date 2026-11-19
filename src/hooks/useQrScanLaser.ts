import { useCallback, useEffect, useRef, useState, type AnimationEvent } from 'react';

/** Must match `--dur-qr-scan` and CSS iteration count on `.qr-laser-line`. */
export const SCAN_SWEEP_MS = 1350;
export const SCAN_SWEEPS = 2;
export const SCAN_SETTLE_MS = SCAN_SWEEP_MS * SCAN_SWEEPS;

export function useQrScanLaser(opts: { reduceMotion: boolean | null }) {
  const [scanning, setScanning] = useState(false);
  /** Bumps to remount the laser so each scan starts at 0%, never mid-pass. */
  const [scanEpoch, setScanEpoch] = useState(0);
  const scanTimer = useRef<number | null>(null);
  const reduceMotion = Boolean(opts.reduceMotion);

  const endScan = useCallback(() => {
    if (scanTimer.current) window.clearTimeout(scanTimer.current);
    scanTimer.current = null;
    setScanning(false);
  }, []);

  const startScan = useCallback(() => {
    // Reduced motion: CSS disables the laser — skip epoch churn / timers.
    if (reduceMotion) return;
    if (scanTimer.current) window.clearTimeout(scanTimer.current);
    setScanEpoch((n) => n + 1);
    setScanning(true);
    // Safety net if animationend is skipped (tab freeze).
    scanTimer.current = window.setTimeout(() => setScanning(false), SCAN_SETTLE_MS + 40);
  }, [reduceMotion]);

  useEffect(() => {
    return () => {
      if (scanTimer.current) window.clearTimeout(scanTimer.current);
    };
  }, []);

  const onLaserAnimationEnd = useCallback(
    (e: AnimationEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.animationName !== 'qr-scan-sweep') return;
      endScan();
    },
    [endScan]
  );

  return { scanning, scanEpoch, startScan, endScan, onLaserAnimationEnd };
}
