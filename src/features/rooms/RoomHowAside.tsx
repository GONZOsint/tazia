import { useT } from '../../i18n';

/** Horizontal how-to steps for the rooms entry screen. */
export function RoomHowSteps() {
  const t = useT();
  const steps = [
    t('roomsHow1'),
    t('roomsHow2'),
    t('roomsHow3'),
    t('roomsHow4'),
    t('roomsHow5'),
  ] as const;

  return (
    <section aria-label={t('roomsHowTitle')} className="w-full">
      <h2 className="text-xs font-semibold text-muted">{t('roomsHowTitle')}</h2>
      <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((label, i) => (
          <li
            key={label}
            className="flex gap-2.5 rounded-xl border border-border bg-surface-raised px-3 py-3 text-sm leading-snug text-muted"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent">
              {i + 1}
            </span>
            <span className="min-w-0 pt-0.5">{label}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 rounded-xl border border-warn-border bg-warn-bg px-3 py-2.5 text-xs leading-relaxed text-warn-ink">
        {t('roomsIpNote')}
      </p>
    </section>
  );
}

/** @deprecated Use RoomHowSteps */
export function RoomHowAside() {
  return <RoomHowSteps />;
}
