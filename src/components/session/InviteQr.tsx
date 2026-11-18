import { useEffect, useState } from 'react';
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

  useEffect(() => {
    let cancelled = false;
    setError(false);
    setDataUrl(null);
    const dark = theme === 'dark' ? '#e8e8e4' : '#0a0a0a';
    const light = theme === 'dark' ? '#1a1a1a' : '#ffffff';
    void import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(inviteUrl, {
          width: size,
          margin: 1,
          color: { dark, light },
        })
      )
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setDataUrl(null);
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [inviteUrl, size, theme]);

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
      <img
        src={dataUrl}
        alt={t('qrAlt')}
        width={size}
        height={size}
        className="rounded-lg border border-border bg-surface-raised p-2"
      />
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
