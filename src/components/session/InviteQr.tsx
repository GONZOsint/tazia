import { useEffect, useRef, useState } from 'react';
import { QrCode } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { DUR, EASE } from '../../motion/tokens';
import { useTheme } from '../../theme';

interface InviteQrProps {
  inviteUrl: string;
  size?: number;
  includesSecret?: boolean;
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
  const prevSecret = useRef(includesSecret);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setDataUrl(null);
    setScanning(false);
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--color-ink').trim() || '#121211';
    const raised = cs.getPropertyValue('--color-surface-raised').trim() || '#efede8';
    /* High-contrast modules: dark ink on raised/white for reliable scanning */
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
          /* Keep sweeping for several passes, then settle */
          scanTimer.current = window.setTimeout(() => setScanning(false), 4200);
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
    if (prevSecret.current === includesSecret) return;
    prevSecret.current = includesSecret;
    if (!includesSecret) {
      setSecretRing(false);
      return;
    }
    setSecretRing(true);
    setScanning(true);
    if (ringTimer.current) window.clearTimeout(ringTimer.current);
    if (scanTimer.current) window.clearTimeout(scanTimer.current);
    ringTimer.current = window.setTimeout(() => setSecretRing(false), 560);
    scanTimer.current = window.setTimeout(() => setScanning(false), 4200);
    return () => {
      if (ringTimer.current) window.clearTimeout(ringTimer.current);
    };
  }, [includesSecret]);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = surfaceRef.current;
    if (!el || window.matchMedia('(hover: none)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    el.style.transition = 'none';
    el.style.transform = `rotateX(${8 - ny * 18}deg) rotateY(${-7 + nx * 18}deg) translateZ(8px) scale(1.03)`;
  };

  const onPointerLeave = () => {
    const el = surfaceRef.current;
    if (!el) return;
    el.style.transition = '';
    el.style.transform = '';
  };

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
    <div className="flex w-full flex-col items-center gap-2.5">
      <div className="qr-perspective mx-auto">
        <div
          ref={surfaceRef}
          className={`qr-surface-3d rounded-[var(--radius-ctrl)] p-2.5 ${
            scanning ? 'scanning' : ''
          } ${secretRing ? 'qr-secret-ring' : ''}`}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
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
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
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
