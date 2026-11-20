import { useEffect, useRef, type RefObject } from 'react';
import {
  DESKTOP_IDLE_BREATH,
  FOLLOW,
  IDLE_BREATH,
  IDLE_BREATH_MS,
  IDLE_DIST,
  LIFT_Z,
  REST,
  RETURN,
  TILT_RANGE,
  TOUCH_FOLLOW,
  TOUCH_LIFT_Z,
  TOUCH_REST,
  TOUCH_RETURN,
  TOUCH_TILT_RANGE,
  glareFromPointer,
  lerp,
  poseNearlyEqual,
  targetFromPointer,
  writeGlare,
  writePose,
  type QrPose,
} from '../motion/qrCard/parallax';

/**
 * Owns QR card transform for as long as a surface is mounted.
 * Depend on qrReady (bool), not dataUrl — phrase-in-link regenerates in place.
 */
export function useQrCardParallax(opts: {
  enabled: boolean;
}): {
  stageRef: RefObject<HTMLDivElement | null>;
  surfaceRef: RefObject<HTMLDivElement | null>;
} {
  const stageRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!opts.enabled) return;
    const stage = stageRef.current;
    const el = surfaceRef.current;
    if (!stage || !el) return;

    // Touch / stylus: no hover parallax — drive from stage gestures + idle breath.
    const isTouch = window.matchMedia('(hover: none)').matches;
    const rest: QrPose = { ...(isTouch ? TOUCH_REST : REST) };
    const tiltRange = isTouch ? TOUCH_TILT_RANGE : TILT_RANGE;
    const liftZ = isTouch ? TOUCH_LIFT_Z : LIFT_Z;
    const follow = isTouch ? TOUCH_FOLLOW : FOLLOW;
    const ret = isTouch ? TOUCH_RETURN : RETURN;

    let raf = 0;
    let running = true;
    let dragging = false;
    /** Desktop: true when pointer is away — light idle breath instead of a frozen rest. */
    let desktopIdle = !isTouch;
    const breathAmp = isTouch ? IDLE_BREATH : DESKTOP_IDLE_BREATH;
    const current: QrPose = { ...rest };
    let target: QrPose = { ...rest };
    let lastTs = performance.now();
    let glareX = isTouch ? 38 : 42;
    let glareY = isTouch ? 22 : 28;
    let targetGlareX = glareX;
    let targetGlareY = glareY;
    const t0 = performance.now();

    // Own the transform so CSS transition / secret fx never fight the lerp.
    el.style.transition = 'box-shadow var(--dur-medium) var(--ease-out-expo)';
    stage.classList.toggle('qr-touch-stage', isTouch);
    writePose(el, current, liftZ);
    writeGlare(el, glareX, glareY);

    const setTilting = (on: boolean) => {
      el.classList.toggle('is-tilting', on);
    };

    const idleBreath = (ts: number): QrPose => {
      const t = ((ts - t0) % IDLE_BREATH_MS) / IDLE_BREATH_MS;
      const a = Math.sin(t * Math.PI * 2);
      const b = Math.cos(t * Math.PI * 2 * 0.85 + 0.4);
      return {
        rotX: rest.rotX + a * breathAmp.rotX,
        rotY: rest.rotY + b * breathAmp.rotY,
        z: rest.z + (0.5 + 0.5 * a) * breathAmp.z,
        scale: rest.scale + (0.5 + 0.5 * a) * breathAmp.scale,
      };
    };

    const tick = (ts: number) => {
      if (!running) return;
      const dt = Math.min(32, ts - lastTs);
      lastTs = ts;
      const frame = dt / 16.67;

      // Idle: living desk-lamp sway (touch always; desktop only when pointer is away).
      if ((isTouch && !dragging) || (!isTouch && desktopIdle)) {
        target = idleBreath(ts);
        const sway = Math.sin(((ts - t0) / IDLE_BREATH_MS) * Math.PI * 2);
        const glareSpan = isTouch ? 10 : 4;
        targetGlareX = (isTouch ? 38 : 42) + sway * glareSpan;
        targetGlareY =
          (isTouch ? 22 : 28) +
          Math.cos(((ts - t0) / IDLE_BREATH_MS) * Math.PI * 2 * 0.85) * (glareSpan * 0.8);
      }

      const breathing = (isTouch && !dragging) || (!isTouch && desktopIdle);
      const k = 1 - Math.pow(1 - (breathing ? ret : follow), frame);
      const glareK = 1 - Math.pow(1 - (isTouch ? 0.12 : 0.16), frame);

      current.rotX = lerp(current.rotX, target.rotX, k);
      current.rotY = lerp(current.rotY, target.rotY, k);
      current.z = lerp(current.z, target.z, k);
      current.scale = lerp(current.scale, target.scale, k);
      glareX = lerp(glareX, targetGlareX, glareK);
      glareY = lerp(glareY, targetGlareY, glareK);
      writePose(el, current, liftZ);
      writeGlare(el, glareX, glareY);

      // Keep the loop alive while idle-breathing; only park when desktop is mid-tilt settle.
      if (isTouch || desktopIdle) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const settled =
        poseNearlyEqual(current, target) &&
        Math.abs(glareX - targetGlareX) < 0.15 &&
        Math.abs(glareY - targetGlareY) < 0.15;
      if (!settled) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
        setTilting(false);
      }
    };

    const kick = (promote = false) => {
      if (promote) setTilting(true);
      if (raf) return;
      lastTs = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const overlayBlocksTilt = (e: EventTarget | null) => {
      const node = e instanceof Element ? e : null;
      return Boolean(node?.closest('[aria-modal="true"], .tazia-toast-card'));
    };

    const pointerNearStage = (clientX: number, clientY: number) => {
      const r = stage.getBoundingClientRect();
      const nx = (clientX - (r.left + r.width / 2)) / (r.width * 0.5);
      const ny = (clientY - (r.top + r.height / 2)) / (r.height * 0.5);
      return Math.hypot(nx, ny) <= IDLE_DIST;
    };

    const applyPointer = (clientX: number, clientY: number, locked: boolean) => {
      if (!isTouch) desktopIdle = false;
      target = targetFromPointer(stage, clientX, clientY, rest, tiltRange, liftZ, locked);
      const g = glareFromPointer(stage, clientX, clientY);
      targetGlareX = g.gx;
      targetGlareY = g.gy;
      kick(true);
    };

    const onMove = (e: PointerEvent) => {
      if (overlayBlocksTilt(e.target)) return;
      if (!pointerNearStage(e.clientX, e.clientY)) {
        if (!desktopIdle) {
          desktopIdle = true;
          setTilting(false);
          kick(false);
        }
        return;
      }
      applyPointer(e.clientX, e.clientY, false);
    };

    const onLeave = () => {
      desktopIdle = true;
      targetGlareX = 42;
      targetGlareY = 28;
      setTilting(false);
      kick(false);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerNearStage(e.clientX, e.clientY)) return;
      applyPointer(e.clientX, e.clientY, false);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        dragging = false;
        if (isTouch) {
          target = idleBreath(performance.now());
          kick(false);
        } else {
          onLeave();
        }
      } else if (!isTouch) {
        desktopIdle = true;
        kick(false);
      }
    };

    const onTouchDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      if (overlayBlocksTilt(e.target)) return;
      dragging = true;
      setTilting(true);
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        /* capture optional */
      }
      applyPointer(e.clientX, e.clientY, true);
    };

    const onTouchMove = (e: PointerEvent) => {
      if (!dragging) return;
      applyPointer(e.clientX, e.clientY, true);
    };

    const onTouchEnd = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      dragging = false;
      setTilting(false);
      try {
        if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      target = idleBreath(performance.now());
      targetGlareX = 38;
      targetGlareY = 22;
      kick();
    };

    if (isTouch) {
      stage.addEventListener('pointerdown', onTouchDown, { passive: true });
      stage.addEventListener('pointermove', onTouchMove, { passive: true });
      stage.addEventListener('pointerup', onTouchEnd, { passive: true });
      stage.addEventListener('pointercancel', onTouchEnd, { passive: true });
      document.addEventListener('visibilitychange', onVisibility);
      kick(false);
    } else {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      document.addEventListener('visibilitychange', onVisibility);
      document.addEventListener('mouseleave', onLeave);
      kick(false);
    }

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      if (isTouch) {
        stage.removeEventListener('pointerdown', onTouchDown);
        stage.removeEventListener('pointermove', onTouchMove);
        stage.removeEventListener('pointerup', onTouchEnd);
        stage.removeEventListener('pointercancel', onTouchEnd);
      } else {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('mouseleave', onLeave);
      }
      document.removeEventListener('visibilitychange', onVisibility);
      stage.classList.remove('qr-touch-stage');
      el.classList.remove('is-tilting');
      el.style.transition = '';
      el.style.transform = '';
      el.style.removeProperty('--qr-shadow-x');
      el.style.removeProperty('--qr-shadow-y');
      el.style.removeProperty('--qr-lift');
      el.style.removeProperty('--qr-gx');
      el.style.removeProperty('--qr-gy');
    };
  }, [opts.enabled]);

  return { stageRef, surfaceRef };
}
