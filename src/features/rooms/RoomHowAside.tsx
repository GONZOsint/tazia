import { useState } from 'react';
import { useT } from '../../i18n';
import { Card } from '../../components/ui/Card';

export function RoomHowAside() {
  const t = useT();
  const [howOpen, setHowOpen] = useState(false);

  return (
    <Card className="bg-bg lg:self-start" padded>
      <button
        type="button"
        onClick={() => setHowOpen((v) => !v)}
        className="flex w-full min-h-[44px] items-center justify-between text-left font-display text-lg font-semibold text-ink lg:pointer-events-none"
      >
        {t('roomsHowTitle')}
        <span className="text-sm font-normal text-muted lg:hidden">{howOpen ? '−' : '+'}</span>
      </button>
      <div className={`${howOpen ? 'block' : 'hidden'} lg:block`}>
        <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-muted">
          <li>{t('roomsHow1')}</li>
          <li>{t('roomsHow2')}</li>
          <li>{t('roomsHow3')}</li>
          <li>{t('roomsHow4')}</li>
          <li>{t('roomsHow5')}</li>
        </ol>
        <p className="mt-5 rounded-xl border border-warn-border bg-warn-bg p-3 text-xs leading-relaxed text-warn-ink">
          {t('roomsIpNote')}
        </p>
      </div>
    </Card>
  );
}
