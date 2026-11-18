import { useEffect, useRef, useState } from 'react';
import { QrCode } from 'lucide-react';
import { useT } from '../../i18n';
import { useTheme } from '../../theme';

interface InviteQrProps {
  inviteUrl: string;
  size?: number;
  includesSecret?: boolean;
}

export function InviteQr({ inviteUrl, size = 180, includesSecret = false }: InviteQrProps) {
  const t = useT();
  const { theme } = useTheme();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const scanTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setDataUrl(null);
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--color-ink').trim() || '#121211';
    const raised = cs.getPropertyValue('--color-surface-raised').trim() || '#efede8';
    /* High-contrast modules: dark ink on raised/white for reliable scanning */
    const dark = theme === 'dark' ? ink : '#0a0d06';
    const light = theme === 'dark' ? raised : '#ffffff';
    void import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(inviteUrl, {
          width: size,
          margin: 1,
          color: { dark, light },
        })
      )
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setScanning(true);
          if (scanTimer.current) window.clearTimeout(scanTimer.current);
          scanTimer.current = window.setTimeout(() => setScanning(false), 700);
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

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = surfaceRef.current;
    if (!el || window.matchMedia('(hover: none)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    el.style.transition = 'none';
    el.style.transform = `rotateX(${-ny * 12}deg) rotateY(${nx * 12}deg) scale(1.02)`;
  };

  const onPointerLeave = () => {
    const el = surfaceRef.current;
    if (!el) return;
    el.style.transition = '';
    el.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
  };

  if (error) {
    return <p className="text-center text-xs text-danger-ink">{t('qrError')}</p>;
  }

  if (!dataUrl) {
    return (
      <div
        className="mx-auto animate-pulse rounded-lg border border-border bg-surface"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="qr-perspective">
        <div
          ref={surfaceRef}
          className={`qr-surface-3d rounded-lg border border-border bg-surface-raised p-2 ${
            scanning ? 'scanning' : ''
          }`}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          <div className="qr-laser-line" aria-hidden="true" />
          <img
            src={dataUrl}
            alt={t('qrAlt')}
            width={size}
            height={size}
            className="block rounded-md"
            draggable={false}
          />
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-center text-[11px] text-muted">
        <QrCode className="h-3 w-3 shrink-0" aria-hidden="true" />
        {t('qrLocal')}
      </p>
      {includesSecret && (
        <p className="text-center text-[11px] font-medium text-warn">{t('roomsQrHasSecret')}</p>
      )}
    </div>
  );
}
