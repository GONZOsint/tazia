import { useEffect, useRef } from 'react';

/**
 * Optional Screen Wake Lock while a zone is active.
 * Keeps the display awake — does not keep WebRTC alive on iOS background.
 */
export function useWakeLock(enabled: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let cancelled = false;

    const release = async () => {
      const cur = lockRef.current;
      lockRef.current = null;
      if (!cur) return;
      try {
        await cur.release();
      } catch {
        /* ignore */
      }
    };

    const request = async () => {
      if (!enabled || cancelled) {
        await release();
        return;
      }
      if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
      if (document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled || !enabled) {
          await lock.release();
          return;
        }
        lockRef.current = lock;
        lock.addEventListener('release', () => {
          if (lockRef.current === lock) lockRef.current = null;
        });
      } catch {
        /* unsupported / denied */
      }
    };

    void request();
    const onVis = () => {
      if (document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void release();
    };
  }, [enabled]);
}
