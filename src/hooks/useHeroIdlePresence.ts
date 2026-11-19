import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HERO_IDLE } from '../motion/tokens';

type Parallax = { x: number; y: number };

/**
 * Subtle hero presence: tab-visibility pause, idle CTA nudge, mark parallax.
 * CSS owns breath/sheen loops; this only gates them + drives JS ornaments.
 */
export function useHeroIdlePresence(enabled: boolean) {
  const heroRef = useRef<HTMLElement | null>(null);
  const markRef = useRef<HTMLDivElement | null>(null);
  const [paused, setPaused] = useState(() =>
    typeof document !== 'undefined' ? document.hidden : false
  );
  const [nudging, setNudging] = useState(false);
  const [parallax, setParallax] = useState<Parallax>({ x: 0, y: 0 });

  const nudgeTimerRef = useRef<number | null>(null);
  const cooldownUntilRef = useRef(0);
  const nudgeClearRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef<Parallax>({ x: 0, y: 0 });
  const currentRef = useRef<Parallax>({ x: 0, y: 0 });

  const clearNudgeTimer = useCallback(() => {
    if (nudgeTimerRef.current != null) {
      window.clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
  }, []);

  const scheduleNudge = useCallback(() => {
    clearNudgeTimer();
    if (!enabled || document.hidden) return;
    const wait = Math.max(0, cooldownUntilRef.current - Date.now()) + HERO_IDLE.nudgeAfterMs;
    nudgeTimerRef.current = window.setTimeout(() => {
      if (!enabled || document.hidden) return;
      setNudging(true);
      cooldownUntilRef.current = Date.now() + HERO_IDLE.nudgeCooldownMs;
      if (nudgeClearRef.current != null) window.clearTimeout(nudgeClearRef.current);
      nudgeClearRef.current = window.setTimeout(() => {
        setNudging(false);
        scheduleNudge();
      }, HERO_IDLE.nudgeMs);
    }, wait);
  }, [clearNudgeTimer, enabled]);

  const noteInteraction = useCallback(() => {
    if (!enabled) return;
    setNudging(false);
    if (nudgeClearRef.current != null) {
      window.clearTimeout(nudgeClearRef.current);
      nudgeClearRef.current = null;
    }
    scheduleNudge();
  }, [enabled, scheduleNudge]);

  useEffect(() => {
    if (!enabled) {
      clearNudgeTimer();
      setNudging(false);
      setParallax({ x: 0, y: 0 });
      targetRef.current = { x: 0, y: 0 };
      currentRef.current = { x: 0, y: 0 };
      return;
    }

    const onVis = () => {
      const hidden = document.hidden;
      setPaused(hidden);
      if (hidden) {
        clearNudgeTimer();
        setNudging(false);
      } else {
        scheduleNudge();
      }
    };

    setPaused(document.hidden);
    if (!document.hidden) scheduleNudge();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearNudgeTimer();
      if (nudgeClearRef.current != null) window.clearTimeout(nudgeClearRef.current);
    };
  }, [clearNudgeTimer, enabled, scheduleNudge]);

  useLayoutEffect(() => {
    if (!enabled) {
      setParallax({ x: 0, y: 0 });
      targetRef.current = { x: 0, y: 0 };
      currentRef.current = { x: 0, y: 0 };
      return;
    }

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!finePointer.matches) return;

    const hero = heroRef.current;
    if (!hero) return;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
      const cur = currentRef.current;
      const tgt = targetRef.current;
      const next = {
        x: lerp(cur.x, tgt.x, 0.08),
        y: lerp(cur.y, tgt.y, 0.08),
      };
      currentRef.current = next;
      if (Math.abs(next.x - tgt.x) > 0.02 || Math.abs(next.y - tgt.y) > 0.02) {
        setParallax(next);
        rafRef.current = window.requestAnimationFrame(tick);
      } else if (cur.x !== tgt.x || cur.y !== tgt.y) {
        setParallax(tgt);
        currentRef.current = tgt;
        rafRef.current = null;
      } else {
        rafRef.current = null;
      }
    };

    const kick = () => {
      if (rafRef.current == null) rafRef.current = window.requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (document.hidden) return;
      const mark = markRef.current;
      if (!mark) return;
      const r = mark.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const nx = (e.clientX - cx) / Math.max(r.width, 1);
      const ny = (e.clientY - cy) / Math.max(r.height, 1);
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      targetRef.current = {
        x: clamp(nx) * HERO_IDLE.parallaxPx,
        y: clamp(ny) * HERO_IDLE.parallaxPx,
      };
      kick();
    };

    const onLeave = () => {
      targetRef.current = { x: 0, y: 0 };
      kick();
    };

    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    return () => {
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled]);

  return {
    heroRef,
    markRef,
    paused,
    nudging,
    parallax,
    noteInteraction,
  };
}
