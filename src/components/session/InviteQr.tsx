import { useEffect, useRef, useState } from 'react';
import { QrCode, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { DUR, EASE } from '../../motion/tokens';
import { useTheme } from '../../theme';

const SCAN_SETTLE_MS = 2800;
const SECRET_RING_MS = 400;

/** Rest pose — soft desk-lamp angle, not a hard card tilt. */
const REST = { rotX: 6.5, rotY: -5.5, z: 0, scale: 1 } as const;
/** Max extra degrees from rest when the pointer is near. */
const TILT_RANGE = 8.5;
/** Lerp factor per frame @60fps — lower = silkier follow. */
const FOLLOW = 0.11;
/** Idle return when the pointer is far from the card. */
const RETURN = 0.07;
/** Beyond this normalized distance, ease back toward rest. */
const IDLE_DIST = 2.4;

interface InviteQrProps {
  inviteUrl: string;
  size?: number;
  includesSecret?: boolean;
}

type Pose = { rotX: number; rotY: number; z: number; scale: number };

function targetFromPointer(el: HTMLElement, clientX: number, clientY: number): Pose {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const nx = (clientX - cx) / (r.width * 0.5);
  const ny = (clientY - cy) / (r.height * 0.5);
  const dist = Math.hypot(nx, ny);

  if (dist > IDLE_DIST) return { ...REST };

  // Soft falloff past the card edge keeps continuous tracking without snaps.
  const falloff = 1 / (1 + Math.max(0, dist - 0.95) * 1.15);
  const clampedX = Math.max(-1.1, Math.min(1.1, nx)) * falloff;
  const clampedY = Math.max(-1.1, Math.min(1.1, ny)) * falloff;
  const near = Math.min(1, falloff);

  return {
    rotX: REST.rotX - clampedY * TILT_RANGE,
    rotY: REST.rotY + clampedX * TILT_RANGE,
    z: 6 * near,
    scale: 1 + 0.014 * near,
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
}

export function InviteQr({ inviteUrl, size = 200, includesSecret = false }: InviteQrProps) {
  const t = useT();
  const { theme } = useTheme();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [secretRing, setSecretRing] = useState(false);
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
    const el = surfaceRef.current;
    if (!el) return;

    const reduced =
      window.matchMedia('(hover: none)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    let raf = 0;
    let running = true;
    const current: Pose = { ...REST };
    let target: Pose = { ...REST };
    let lastTs = performance.now();

    // Own the transform so CSS transition / secret fx never fight the lerp.
    el.style.transition = 'box-shadow var(--dur-medium) var(--ease-out-expo)';
    writePose(el, current);

    const tick = (ts: number) => {
      if (!running) return;
      const dt = Math.min(32, ts - lastTs);
      lastTs = ts;
      const frame = dt / 16.67;
      const towardRest = poseNearlyEqual(target, REST);
      const k = 1 - Math.pow(1 - (towardRest ? RETURN : FOLLOW), frame);

      current.rotX = lerp(current.rotX, target.rotX, k);
      current.rotY = lerp(current.rotY, target.rotY, k);
      current.z = lerp(current.z, target.z, k);
      current.scale = lerp(current.scale, target.scale, k);
      writePose(el, current);

      const settled = poseNearlyEqual(current, target);
      if (!settled || !towardRest) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
        writePose(el, REST);
      }
    };

    const kick = () => {
      if (raf) return;
      lastTs = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      target = targetFromPointer(el, e.clientX, e.clientY);
      kick();
    };

    const onLeave = () => {
      target = { ...REST };
      kick();
    };

    // After click / modal confirm, re-sample pointer so tilt keeps flowing instead of freezing.
    const onPointerUp = (e: PointerEvent) => {
      target = targetFromPointer(el, e.clientX, e.clientY);
      kick();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('blur', onLeave);
    document.addEventListener('mouseleave', onLeave);

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('blur', onLeave);
      document.removeEventListener('mouseleave', onLeave);
      el.style.transition = '';
      el.style.transform = '';
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
        <div className="h-full w-full animate-pulse rounded-[calc(var(--radius-ctrl)-4px)] bg-surface" />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="qr-perspective mx-auto">
        <div
          ref={surfaceRef}
          className={`qr-surface-3d rounded-[var(--radius-ctrl)] p-2.5 ${
            scanning ? 'scanning' : ''
          } ${secretRing ? 'qr-secret-ring' : ''} ${includesSecret ? 'qr-has-secret' : ''}`}
        >
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
      <p className="flex max-w-[16rem] items-center justify-center gap-1.5 text-center text-[11px] leading-snug text-muted">
        <QrCode className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden="true" />
        {t('qrLocal')}
      </p>
      <AnimatePresence initial={false}>
        {includesSecret && (
          <motion.p
            key="secret-warn"
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: DUR.switch, ease: EASE.outExpo }}
            className="flex max-w-[16rem] items-center justify-center gap-1.5 text-center text-[11px] font-medium text-warn"
            role="status"
          >
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t('roomsQrHasSecret')}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
