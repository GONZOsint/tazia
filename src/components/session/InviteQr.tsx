import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { useT } from '../../i18n';
import { geomForQrSurface } from '../../motion/qrSecretFire';
import { useTheme } from '../../theme';
import { useQrCardParallax } from '../../hooks/useQrCardParallax';
import { useQrScanLaser } from '../../hooks/useQrScanLaser';
import { useQrSecretFire } from '../../hooks/useQrSecretFire';
import { InviteQrCard, QR_CARD_RADIUS, QR_PAD } from './InviteQrCard';

interface InviteQrProps {
  inviteUrl: string;
  size?: number;
  includesSecret?: boolean;
}

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
let colorCtx: CanvasRenderingContext2D | null | undefined;

/** Prefetch qrcode so first paint doesn't wait on the dynamic chunk. */
const qrcodeMod = import('qrcode');

function getColorContext(): CanvasRenderingContext2D | null {
  if (colorCtx !== undefined) return colorCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  colorCtx = canvas.getContext('2d', { willReadFrequently: true });
  return colorCtx;
}

function resolveCssColorToHex(raw: string, fallback: string): string {
  if (!raw) return fallback;
  if (HEX_COLOR_RE.test(raw)) return raw;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && !CSS.supports('color', raw)) {
    return fallback;
  }
  const ctx = getColorContext();
  if (!ctx) return fallback;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = raw;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return a < 255
    ? `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`
    : `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function readThemeQrColors(): { ink: string; raised: string } {
  const cs = getComputedStyle(document.documentElement);
  return {
    ink: resolveCssColorToHex(cs.getPropertyValue('--color-ink').trim(), '#141310'),
    raised: resolveCssColorToHex(
      cs.getPropertyValue('--color-surface-raised').trim(),
      '#f1eee8',
    ),
  };
}

export function InviteQr({ inviteUrl, size = 200, includesSecret = false }: InviteQrProps) {
  const t = useT();
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const qrReady = dataUrl !== null;
  const surfaceCss = size + QR_PAD;
  const fireGeom = useMemo(
    // Stroke outside the card frame (inset 0), not over the QR bitmap.
    () => geomForQrSurface(surfaceCss, QR_CARD_RADIUS, 0),
    [surfaceCss],
  );

  const { scanning, scanEpoch, startScan, onLaserAnimationEnd } = useQrScanLaser({
    reduceMotion,
  });
  const { stageRef, surfaceRef } = useQrCardParallax({
    enabled: qrReady && !reduceMotion,
  });
  const fireCanvasRef = useQrSecretFire({
    enabled: qrReady && !reduceMotion,
    geom: fireGeom,
    includesSecret,
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Keep previous bitmap mounted while regenerating (theme / URL change).
      const { ink, raised } = readThemeQrColors();
      // Cap at 2× — sharp enough, much faster encode than 3×.
      const scale = Math.min(Math.max(Math.ceil(window.devicePixelRatio || 1.5), 1), 2);

      try {
        const QRCode = await qrcodeMod;
        if (cancelled) return;
        const url = await QRCode.toDataURL(inviteUrl, {
          width: size * scale,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: ink, light: raised },
        });
        if (cancelled) return;
        setError(false);
        setDataUrl(url);
        startScan();
      } catch {
        if (cancelled) return;
        setDataUrl(null);
        setError(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [inviteUrl, size, theme, startScan]);

  if (error && !dataUrl) {
    return <p className="text-center text-xs text-danger-ink">{t('qrError')}</p>;
  }

  if (!dataUrl) {
    return (
      <div
        className="qr-surface-3d mx-auto rounded-[var(--radius-ctrl)] p-2.5"
        style={{ width: surfaceCss, height: surfaceCss }}
        aria-hidden="true"
      >
        <div className="qr-surface-face">
          <div
            className="h-full w-full animate-pulse rounded-[calc(var(--radius-ctrl)-4px)] bg-surface"
            style={{ height: size, width: size }}
          />
        </div>
      </div>
    );
  }

  return (
    <InviteQrCard
      size={size}
      dataUrl={dataUrl}
      includesSecret={includesSecret}
      scanning={scanning}
      scanEpoch={scanEpoch}
      fireGeom={fireGeom}
      stageRef={stageRef}
      surfaceRef={surfaceRef}
      fireCanvasRef={fireCanvasRef}
      onLaserAnimationEnd={onLaserAnimationEnd}
      qrAlt={t('qrAlt')}
      qrLocal={t('qrLocal')}
      roomsQrHasSecret={t('roomsQrHasSecret')}
    />
  );
}
