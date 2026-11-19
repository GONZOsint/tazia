import { useEffect, useRef, useState } from 'react';
import { QrCode, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { contentSwitch } from '../../motion/tokens';
import { useTheme } from '../../theme';

const SCAN_SETTLE_MS = 2800;
/** Must match `--dur-secret-frame` draw + settle in CSS. */
const SECRET_RING_MS = 720;

/** Rest pose — soft desk-lamp angle; keep ≤~10° so the QR stays readable. */
const REST = { rotX: 5.5, rotY: -4.5, z: 0, scale: 1 } as const;
/** Max extra degrees from rest when the pointer is near. */
const TILT_RANGE = 7;
/** Lerp factor per frame @60fps — lower = silkier follow. */
const FOLLOW = 0.12;
/** Idle return when the pointer is far from the card. */
const RETURN = 0.065;
/** Beyond this normalized distance, ease back toward rest. */
const IDLE_DIST = 2.35;

interface InviteQrProps {
  inviteUrl: string;
  size?: number;
  includesSecret?: boolean;
}

type Pose = { rotX: number; rotY: number; z: number; scale: number };

function targetFromPointer(stage: HTMLElement, clientX: number, clientY: number): Pose {
  // Measure against the flat perspective stage — never the tilting surface
  // (tilted getBoundingClientRect feeds back into the next frame and jitters).
  const r = stage.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const nx = (clientX - cx) / (r.width * 0.5);
  const ny = (clientY - cy) / (r.height * 0.5);
  const dist = Math.hypot(nx, ny);

  if (dist > IDLE_DIST) return { ...REST };

  // Soft falloff past the card edge keeps continuous tracking without snaps.
  const falloff = 1 / (1 + Math.max(0, dist - 0.95) * 1.15);
  const clampedX = Math.max(-1.05, Math.min(1.05, nx)) * falloff;
  const clampedY = Math.max(-1.05, Math.min(1.05, ny)) * falloff;
  const near = Math.min(1, falloff);

  return {
    rotX: REST.rotX - clampedY * TILT_RANGE,
    rotY: REST.rotY + clampedX * TILT_RANGE,
    z: 8 * near,
    scale: 1 + 0.012 * near,
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

function writePose(el: HTMLElement, p: Pose) {
  el.style.transform = `rotateX(${p.rotX.toFixed(3)}deg) rotateY(${p.rotY.toFixed(3)}deg) translateZ(${p.z.toFixed(2)}px) scale(${p.scale.toFixed(4)})`;
  // Shadow tracks tilt so lift reads as depth, not a sliding sticker.
  const lift = Math.min(1, Math.max(0, (p.z / 8) * 0.85 + (p.scale - 1) / 0.012 * 0.15));
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
  const [secretRing, setSecretRing] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const scanTimer = useRef<number | null>(null);
  const ringTimer = useRef<number | null>(null);
  const prevSecret = useRef(false);
  const secretBootstrapped = useRef(false);
  const qrReady = dataUrl !== null;

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
          setScanning(true);
          if (scanTimer.current) window.clearTimeout(scanTimer.current);
          scanTimer.current = window.setTimeout(() => setScanning(false), SCAN_SETTLE_MS);
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

  useEffect(() => {
    const runSecretFx = () => {
      setSecretRing(true);
      setScanning(true);
      if (ringTimer.current) window.clearTimeout(ringTimer.current);
      if (scanTimer.current) window.clearTimeout(scanTimer.current);
      ringTimer.current = window.setTimeout(() => setSecretRing(false), SECRET_RING_MS);
      scanTimer.current = window.setTimeout(() => setScanning(false), SCAN_SETTLE_MS);
    };

    if (!secretBootstrapped.current) {
      secretBootstrapped.current = true;
      prevSecret.current = includesSecret;
      if (includesSecret && dataUrl) runSecretFx();
      return;
    }

    if (prevSecret.current === includesSecret) return;
    prevSecret.current = includesSecret;
    if (!includesSecret) {
      setSecretRing(false);
      return;
    }
    runSecretFx();
    return () => {
      if (ringTimer.current) window.clearTimeout(ringTimer.current);
    };
  }, [includesSecret, dataUrl]);

  // Tilt owns transform for as long as a QR surface is mounted.
  // Depend on qrReady (bool), not dataUrl string — phrase-in-link regenerates the bitmap in place.
  useEffect(() => {
    if (!qrReady) return;
    const stage = stageRef.current;
    const el = surfaceRef.current;
    if (!stage || !el) return;

    const reduced =
      window.matchMedia('(hover: none)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    let raf = 0;
    let running = true;
    const current: Pose = { ...REST };
    let target: Pose = { ...REST };
    let lastTs = performance.now();
    let glareX = 42;
    let glareY = 28;
    let targetGlareX = glareX;
    let targetGlareY = glareY;

    // Own the transform so CSS transition / secret fx never fight the lerp.
    el.style.transition = 'box-shadow var(--dur-medium) var(--ease-out-expo)';
    writePose(el, current);
    writeGlare(el, glareX, glareY);

    const setTilting = (on: boolean) => {
      el.classList.toggle('is-tilting', on);
    };

    const tick = (ts: number) => {
      if (!running) return;
      const dt = Math.min(32, ts - lastTs);
      lastTs = ts;
      const frame = dt / 16.67;
      const towardRest = poseNearlyEqual(target, REST);
      const k = 1 - Math.pow(1 - (towardRest ? RETURN : FOLLOW), frame);
      const glareK = 1 - Math.pow(1 - 0.16, frame);

      current.rotX = lerp(current.rotX, target.rotX, k);
      current.rotY = lerp(current.rotY, target.rotY, k);
      current.z = lerp(current.z, target.z, k);
      current.scale = lerp(current.scale, target.scale, k);
      glareX = lerp(glareX, targetGlareX, glareK);
      glareY = lerp(glareY, targetGlareY, glareK);
      writePose(el, current);
      writeGlare(el, glareX, glareY);

      const settled =
        poseNearlyEqual(current, target) &&
        Math.abs(glareX - targetGlareX) < 0.15 &&
        Math.abs(glareY - targetGlareY) < 0.15;
      if (!settled || !towardRest) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
        writePose(el, REST);
        writeGlare(el, 42, 28);
        setTilting(false);
      }
    };

    const kick = () => {
      setTilting(true);
      if (raf) return;
      lastTs = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const overlayBlocksTilt = (e: EventTarget | null) => {
      const node = e instanceof Element ? e : null;
      return Boolean(node?.closest('[aria-modal="true"], .tazia-toast-card'));
    };

    const onMove = (e: PointerEvent) => {
      // Keep the current 3D pose while the phrase confirm / toast owns the pointer.
      if (overlayBlocksTilt(e.target)) return;
      target = targetFromPointer(stage, e.clientX, e.clientY);
      const g = glareFromPointer(stage, e.clientX, e.clientY);
      targetGlareX = g.gx;
      targetGlareY = g.gy;
      kick();
    };

    const onLeave = () => {
      target = { ...REST };
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
      target = targetFromPointer(stage, e.clientX, e.clientY);
      const g = glareFromPointer(stage, e.clientX, e.clientY);
      targetGlareX = g.gx;
      targetGlareY = g.gy;
      kick();
    };

    // Tab hide only — in-page focus (confirm modal) must not flatten the 3D pose.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onLeave();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('mouseleave', onLeave);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('mouseleave', onLeave);
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
          ref={surfaceRef}
          className={`qr-surface-3d rounded-[var(--radius-ctrl)] p-2.5 ${
            scanning ? 'scanning' : ''
          } ${secretRing ? 'qr-secret-ring' : ''} ${includesSecret ? 'qr-has-secret' : ''}`}
        >
          {/* Frame lives outside the face overflow so the stroke draws around the card
              without touching transform / box-shadow (JS owns the 3D lerp). */}
          <svg
            className="qr-secret-frame"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect
              className="qr-secret-frame__path"
              x="1.25"
              y="1.25"
              width="97.5"
              height="97.5"
              rx="4.5"
              pathLength={1}
            />
          </svg>
          <div className="qr-surface-face rounded-[calc(var(--radius-ctrl)-4px)]">
            <div className="qr-laser-line" aria-hidden="true" />
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
