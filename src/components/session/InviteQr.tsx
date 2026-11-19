import { useEffect, useRef, useState } from 'react';
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

export function InviteQr({ inviteUrl, size = 200, includesSecret = false }: InviteQrProps) {
  const t = useT();
  const { theme } = useTheme();
  const reduceMotion = useReducedMotion();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const prevSecretRef = useRef(false);
  const qrReady = dataUrl !== null;
  const surfaceCss = size + QR_PAD;
  const fireGeom = geomForQrSurface(surfaceCss, QR_CARD_RADIUS);

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
    setError(false);
    // Keep the previous bitmap mounted so the 3D surface / tilt never unmounts mid-click.
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--color-ink').trim() || '#141310';
    const raised = cs.getPropertyValue('--color-surface-raised').trim() || '#f1eee8';
    void import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(inviteUrl, {
          width: size * 2,
          margin: 1,
          color: { dark: ink, light: raised },
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
          setDataUrl((prev) => {
            if (!prev) setError(true);
            return prev;
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [inviteUrl, size, theme, startScan]);

  useEffect(() => {
    const becameSecret = includesSecret && !prevSecretRef.current;
    prevSecretRef.current = includesSecret;
    if (becameSecret && qrReady) startScan();
  }, [includesSecret, qrReady, startScan]);

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
