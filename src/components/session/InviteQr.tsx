import { useEffect, useRef, useState } from 'react';
import { QrCode } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { DUR, EASE } from '../../motion/tokens';
import { useTheme } from '../../theme';

const SCAN_SETTLE_MS = 2800;
const SECRET_RING_MS = 400;

interface InviteQrProps {
  inviteUrl: string;
  size?: number;
  includesSecret?: boolean;
}

function applyTilt(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  // Normalize by half-size; outside the rect falloff keeps continuous tracking.
  const nx = (clientX - cx) / (r.width * 0.5);
  const ny = (clientY - cy) / (r.height * 0.5);
  const dist = Math.hypot(nx, ny);
  const falloff = 1 / (1 + Math.max(0, dist - 1) * 0.85);
  const clampedX = Math.max(-1.35, Math.min(1.35, nx)) * falloff;
  const clampedY = Math.max(-1.35, Math.min(1.35, ny)) * falloff;
  const rotX = 8 - clampedY * 14;
  const rotY = -7 + clampedX * 14;
  const scale = 1 + 0.02 * Math.min(1, falloff);
  el.style.transition = 'none';
  el.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(8px) scale(${scale})`;
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

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setDataUrl(null);
    setScanning(false);
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
          setDataUrl(null);
          setError(true);
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

  useEffect(() => {
    if (!dataUrl) return;
    const el = surfaceRef.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      if (window.matchMedia('(hover: none)').matches) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      applyTilt(el, e.clientX, e.clientY);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      el.style.transition = '';
      el.style.transform = '';
    };
  }, [dataUrl]);

  if (error) {
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
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: DUR.tab, ease: EASE.outExpo }}
            className="text-center text-[11px] font-medium text-warn"
          >
            {t('roomsQrHasSecret')}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
