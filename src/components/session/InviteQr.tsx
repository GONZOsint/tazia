import { useEffect, useRef, useState } from 'react';
import { QrCode, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { contentSwitch } from '../../motion/tokens';
import {
  geomForQrSurface,
  QR_SECRET_FIRE,
  QrSecretFireController,
} from '../../motion/qrSecretFire';
import { useTheme } from '../../theme';

/** Must match `--dur-qr-scan` and CSS iteration count on `.qr-laser-line`. */
const SCAN_SWEEP_MS = 1350;
const SCAN_SWEEPS = 2;
const SCAN_SETTLE_MS = SCAN_SWEEP_MS * SCAN_SWEEPS;
/** Matches `--radius-ctrl` on `.qr-surface-3d`. */
const QR_CARD_RADIUS = 10;
/** Face padding (`p-2.5`) × 2. */
const QR_PAD = 20;

/** Rest pose — soft desk-lamp angle; keep ≤~10° so the QR stays readable. */
const REST = { rotX: 5.5, rotY: -4.5, z: 0, scale: 1 } as const;
/** Touch: steeper desk angle so depth reads without hover parallax. */
const TOUCH_REST = { rotX: 9.5, rotY: -7.2, z: 2, scale: 1 } as const;
/** Max extra degrees from rest when the pointer is near. */
const TILT_RANGE = 7;
const TOUCH_TILT_RANGE = 11;
/** Lift (px) at full nearness — used for shadow/glare normalization. */
const LIFT_Z = 8;
const TOUCH_LIFT_Z = 14;
/** Lerp factor per frame @60fps — lower = silkier follow. */
const FOLLOW = 0.12;
const TOUCH_FOLLOW = 0.18;
/** Idle return when the pointer is far from the card. */
const RETURN = 0.065;
const TOUCH_RETURN = 0.09;
/** Beyond this normalized distance, ease back toward rest. */
const IDLE_DIST = 2.35;
/** Soft breathing amplitude (deg / px) while a finger isn't on the card. */
const IDLE_BREATH = { rotX: 1.35, rotY: 1.1, z: 1.6 } as const;
const IDLE_BREATH_MS = 4200;

interface InviteQrProps {
  inviteUrl: string;
  size?: number;
  includesSecret?: boolean;
}

type Pose = { rotX: number; rotY: number; z: number; scale: number };

function targetFromPointer(
  stage: HTMLElement,
  clientX: number,
  clientY: number,
  rest: Pose,
  tiltRange: number,
  liftZ: number,
  /** Touch drag stays engaged past the card edge; mouse uses soft falloff. */
  locked = false
): Pose {
  // Measure against the flat perspective stage — never the tilting surface
  // (tilted getBoundingClientRect feeds back into the next frame and jitters).
  const r = stage.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const nx = (clientX - cx) / (r.width * 0.5);
  const ny = (clientY - cy) / (r.height * 0.5);
  const dist = Math.hypot(nx, ny);

  if (!locked && dist > IDLE_DIST) return { ...rest };

  // Soft falloff past the card edge keeps continuous tracking without snaps.
  const falloff = locked
    ? 1
    : 1 / (1 + Math.max(0, dist - 0.95) * 1.15);
  const clamp = locked ? 1.15 : 1.05;
  const clampedX = Math.max(-clamp, Math.min(clamp, nx)) * falloff;
  const clampedY = Math.max(-clamp, Math.min(clamp, ny)) * falloff;
  const near = locked ? Math.min(1, 0.55 + (1 - Math.min(1, dist)) * 0.45) : Math.min(1, falloff);

  return {
    rotX: rest.rotX - clampedY * tiltRange,
    rotY: rest.rotY + clampedX * tiltRange,
    z: rest.z + liftZ * near,
    scale: 1 + (locked ? 0.02 : 0.012) * near,
  };
}

function glareFromPointer(stage: HTMLElement, clientX: number, clientY: number) {
  const r = stage.getBoundingClientRect();
  const gx = ((clientX - r.left) / Math.max(1, r.width)) * 100;
  const gy = ((clientY - r.top) / Math.max(1, r.height)) * 100;
  return {
    gx: Math.max(6, Math.min(94, gx)),
    gy: Math.max(6, Math.min(94, gy)),
  };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function poseNearlyEqual(a: Pose, b: Pose) {
  return (
    Math.abs(a.rotX - b.rotX) < 0.02 &&
    Math.abs(a.rotY - b.rotY) < 0.02 &&
    Math.abs(a.z - b.z) < 0.05 &&
    Math.abs(a.scale - b.scale) < 0.0004
  );
}

function writePose(el: HTMLElement, p: Pose, liftZ = LIFT_Z) {
  el.style.transform = `rotateX(${p.rotX.toFixed(3)}deg) rotateY(${p.rotY.toFixed(3)}deg) translateZ(${p.z.toFixed(2)}px) scale(${p.scale.toFixed(4)})`;
  // Shadow tracks tilt so lift reads as depth, not a sliding sticker.
  const scaleSpan = liftZ === TOUCH_LIFT_Z ? 0.02 : 0.012;
  const lift = Math.min(
    1,
    Math.max(0, (p.z / Math.max(1, liftZ)) * 0.85 + (p.scale - 1) / scaleSpan * 0.15)
  );
  const shadowX = (-p.rotY * 0.55).toFixed(2);
  const shadowY = (10 + p.rotX * 0.65 + lift * 6).toFixed(2);
  el.style.setProperty('--qr-shadow-x', `${shadowX}px`);
  el.style.setProperty('--qr-shadow-y', `${shadowY}px`);
  el.style.setProperty('--qr-lift', lift.toFixed(3));
}

function writeGlare(el: HTMLElement, gx: number, gy: number) {
  el.style.setProperty('--qr-gx', `${gx.toFixed(1)}%`);
  el.style.setProperty('--qr-gy', `${gy.toFixed(1)}%`);
}

export function InviteQr({ inviteUrl, size = 200, includesSecret = false }: InviteQrProps) {
  const t = useT();
  const { theme } = useTheme();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [scanning, setScanning] = useState(false);
  /** Bumps to remount the laser so each scan starts at 0%, never mid-pass. */
  const [scanEpoch, setScanEpoch] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const fireCanvasRef = useRef<HTMLCanvasElement>(null);
  const fireCtrlRef = useRef<QrSecretFireController | null>(null);
  const includesSecretRef = useRef(includesSecret);
  const prevSecretRef = useRef(false);
  const scanTimer = useRef<number | null>(null);
  const qrReady = dataUrl !== null;
  const surfaceCss = size + QR_PAD;
  const fireGeom = geomForQrSurface(surfaceCss, QR_CARD_RADIUS);
  includesSecretRef.current = includesSecret;

  const startScan = () => {
    if (scanTimer.current) window.clearTimeout(scanTimer.current);
    setScanEpoch((n) => n + 1);
    setScanning(true);
    // Safety net if animationend is skipped (reduced-motion / tab freeze).
    scanTimer.current = window.setTimeout(() => setScanning(false), SCAN_SETTLE_MS + 40);
  };

  const endScan = () => {
    if (scanTimer.current) window.clearTimeout(scanTimer.current);
    scanTimer.current = null;
    setScanning(false);
  };

  useEffect(() => {
    let cancelled = false;
    setError(false);
    // Keep the previous bitmap mounted so the 3D surface / tilt never unmounts mid-click.
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--color-ink').trim() || '#121211';
    const raised = cs.getPropertyValue('--color-surface-raised').trim() || '#efede8';
    const dark = theme === 'dark' ? ink : '#0a0d06';
    const light = theme === 'dark' ? raised : '#ffffff';
    void import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(inviteUrl, {
          width: size * 2,
          margin: 1,
          color: { dark, light },
        })
      )
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          startScan();
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Keep the last good QR; only flag error when nothing is on screen yet.
          setDataUrl((prev) => {
            if (!prev) setError(true);
            return prev;
          });
        }
      });
    return () => {
      cancelled = true;
      if (scanTimer.current) window.clearTimeout(scanTimer.current);
    };
  }, [inviteUrl, size, theme]);

  // Perimeter fire lives on the same 3D surface as the QR (translateZ sibling).
  useEffect(() => {
    if (!qrReady) return;
    const canvas = fireCanvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let ctrl: QrSecretFireController;
    try {
      ctrl = new QrSecretFireController(canvas, fireGeom);
    } catch {
      return;
    }
    fireCtrlRef.current = ctrl;
    ctrl.setFireOn(includesSecretRef.current);

    return () => {
      ctrl.dispose();
      if (fireCtrlRef.current === ctrl) fireCtrlRef.current = null;
    };
    // geom fields — avoid re-creating when only the object identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrReady, fireGeom.canvasSize, fireGeom.lineSize, fireGeom.lineRadius]);

  useEffect(() => {
    fireCtrlRef.current?.setFireOn(includesSecret);
    const becameSecret = includesSecret && !prevSecretRef.current;
    prevSecretRef.current = includesSecret;
    if (becameSecret && qrReady) startScan();
  }, [includesSecret, qrReady]);

  // Tilt owns transform for as long as a QR surface is mounted.
  // Depend on qrReady (bool), not dataUrl string — phrase-in-link regenerates the bitmap in place.
  useEffect(() => {
    if (!qrReady) return;
    const stage = stageRef.current;
    const el = surfaceRef.current;
    if (!stage || !el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Touch / stylus: no hover parallax — drive from stage gestures + idle breath.
    const isTouch = window.matchMedia('(hover: none)').matches;
    const rest: Pose = { ...(isTouch ? TOUCH_REST : REST) };
    const tiltRange = isTouch ? TOUCH_TILT_RANGE : TILT_RANGE;
    const liftZ = isTouch ? TOUCH_LIFT_Z : LIFT_Z;
    const follow = isTouch ? TOUCH_FOLLOW : FOLLOW;
    const ret = isTouch ? TOUCH_RETURN : RETURN;

    let raf = 0;
    let running = true;
    let dragging = false;
    const current: Pose = { ...rest };
    let target: Pose = { ...rest };
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

    const idleBreath = (ts: number): Pose => {
      const t = ((ts - t0) % IDLE_BREATH_MS) / IDLE_BREATH_MS;
      const a = Math.sin(t * Math.PI * 2);
      const b = Math.cos(t * Math.PI * 2 * 0.85 + 0.4);
      return {
        rotX: rest.rotX + a * IDLE_BREATH.rotX,
        rotY: rest.rotY + b * IDLE_BREATH.rotY,
        z: rest.z + (0.5 + 0.5 * a) * IDLE_BREATH.z,
        scale: 1,
      };
    };

    const tick = (ts: number) => {
      if (!running) return;
      const dt = Math.min(32, ts - lastTs);
      lastTs = ts;
      const frame = dt / 16.67;

      // Touch idle: keep a living desk-lamp sway until a finger locks the pose.
      if (isTouch && !dragging) {
        target = idleBreath(ts);
        const sway = Math.sin(((ts - t0) / IDLE_BREATH_MS) * Math.PI * 2);
        targetGlareX = 38 + sway * 10;
        targetGlareY = 22 + Math.cos(((ts - t0) / IDLE_BREATH_MS) * Math.PI * 2 * 0.85) * 8;
      }

      const towardRest = !isTouch && poseNearlyEqual(target, rest);
      const k = 1 - Math.pow(1 - (towardRest ? ret : follow), frame);
      const glareK = 1 - Math.pow(1 - (isTouch ? 0.12 : 0.16), frame);

      current.rotX = lerp(current.rotX, target.rotX, k);
      current.rotY = lerp(current.rotY, target.rotY, k);
      current.z = lerp(current.z, target.z, k);
      current.scale = lerp(current.scale, target.scale, k);
      glareX = lerp(glareX, targetGlareX, glareK);
      glareY = lerp(glareY, targetGlareY, glareK);
      writePose(el, current, liftZ);
      writeGlare(el, glareX, glareY);

      if (isTouch) {
        // Always keep the loop alive for idle breath / drag follow.
        raf = requestAnimationFrame(tick);
        return;
      }

      const settled =
        poseNearlyEqual(current, target) &&
        Math.abs(glareX - targetGlareX) < 0.15 &&
        Math.abs(glareY - targetGlareY) < 0.15;
      if (!settled || !towardRest) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
        writePose(el, rest, liftZ);
        writeGlare(el, 42, 28);
        setTilting(false);
      }
    };

    const kick = (promote = !isTouch) => {
      // Desktop: will-change while the lerp runs. Touch: only while dragging.
      if (promote) setTilting(true);
      if (raf) return;
      lastTs = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const overlayBlocksTilt = (e: EventTarget | null) => {
      const node = e instanceof Element ? e : null;
      return Boolean(node?.closest('[aria-modal="true"], .tazia-toast-card'));
    };

    const applyPointer = (clientX: number, clientY: number, locked: boolean) => {
      target = targetFromPointer(stage, clientX, clientY, rest, tiltRange, liftZ, locked);
      const g = glareFromPointer(stage, clientX, clientY);
      targetGlareX = g.gx;
      targetGlareY = g.gy;
      kick();
    };

    const onMove = (e: PointerEvent) => {
      // Keep the current 3D pose while the phrase confirm / toast owns the pointer.
      if (overlayBlocksTilt(e.target)) return;
      applyPointer(e.clientX, e.clientY, false);
    };

    const onLeave = () => {
      target = { ...rest };
      targetGlareX = 42;
      targetGlareY = 28;
      kick();
    };

    const pointerNearStage = (clientX: number, clientY: number) => {
      const r = stage.getBoundingClientRect();
      const nx = (clientX - (r.left + r.width / 2)) / (r.width * 0.5);
      const ny = (clientY - (r.top + r.height / 2)) / (r.height * 0.5);
      return Math.hypot(nx, ny) <= IDLE_DIST;
    };

    // Only re-sample when the pointer is still near the QR — modal/toast clicks
    // must not yank the tilt back to rest mid-ritual.
    const onPointerUp = (e: PointerEvent) => {
      if (!pointerNearStage(e.clientX, e.clientY)) return;
      applyPointer(e.clientX, e.clientY, false);
    };

    // Tab hide only — in-page focus (confirm modal) must not flatten the 3D pose.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        dragging = false;
        if (isTouch) {
          target = idleBreath(performance.now());
          kick();
        } else {
          onLeave();
        }
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
        /* capture optional — move still works while finger is over stage */
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
      // Hand back to idle breath — don't snap flat.
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
      kick();
    } else {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      document.addEventListener('visibilitychange', onVisibility);
      document.addEventListener('mouseleave', onLeave);
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
  }, [qrReady]);

  if (error && !dataUrl) {
    return <p className="text-center text-xs text-danger-ink">{t('qrError')}</p>;
  }

  if (!dataUrl) {
    return (
      <div
        className="qr-surface-3d mx-auto rounded-[var(--radius-ctrl)] p-2.5"
        style={{ width: size + 20, height: size + 20 }}
        aria-hidden="true"
      >
        <div className="qr-surface-face">
          <div className="h-full w-full animate-pulse rounded-[calc(var(--radius-ctrl)-4px)] bg-surface" style={{ height: size, width: size }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div ref={stageRef} className="qr-perspective mx-auto">
        <div
          className={`qr-ambient-glow ${includesSecret ? 'qr-ambient-glow--fire' : ''}`}
          aria-hidden="true"
        />
        <div
          ref={surfaceRef}
          className={`qr-surface-3d rounded-[var(--radius-ctrl)] p-2.5 ${
            scanning ? 'scanning' : ''
          } ${includesSecret ? 'qr-has-secret' : ''}`}
        >
          {/* Fire canvas is a sibling of the face on the tilting surface (translateZ). */}
          <canvas
            ref={fireCanvasRef}
            className="qr-secret-fire"
            style={{
              width: fireGeom.canvasSize,
              height: fireGeom.canvasSize,
              top: -QR_SECRET_FIRE.pad,
              left: -QR_SECRET_FIRE.pad,
            }}
            aria-hidden="true"
          />
          <div className="qr-surface-face rounded-[calc(var(--radius-ctrl)-4px)]">
            <div
              key={scanEpoch}
              className="qr-laser-line"
              aria-hidden="true"
              onAnimationEnd={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.animationName !== 'qr-scan-sweep') return;
                endScan();
              }}
            />
            <img
              src={dataUrl}
              alt={t('qrAlt')}
              width={size}
              height={size}
              className="block max-w-full rounded-[calc(var(--radius-ctrl)-4px)]"
              draggable={false}
            />
          </div>
        </div>
      </div>
      <p className="flex max-w-[16rem] items-center justify-center gap-1.5 text-center text-[11px] leading-snug text-muted">
        <QrCode className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
        {t('qrLocal')}
      </p>
      {/* Fixed slot so the secret warning never reflows the 3D stage. */}
      <div className="flex min-h-[1.35rem] max-w-[16rem] items-center justify-center">
        <AnimatePresence initial={false}>
          {includesSecret && (
            <motion.p
              key="secret-warn"
              initial={contentSwitch.initial}
              animate={contentSwitch.animate}
              exit={contentSwitch.exit}
              transition={contentSwitch.transition}
              className="flex items-center justify-center gap-1.5 text-center text-[11px] font-medium text-warn"
              role="status"
            >
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('roomsQrHasSecret')}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
