import { useRegisterSW } from 'virtual:pwa-register/react';
import { AlertBanner } from '../components/ui/AlertBanner';
import { useT } from '../i18n';

/** Prompt reload when a new service worker is waiting (crypto/wire breaks need a shared build). */
export function PwaUpdateBanner() {
  const t = useT();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  });

  if (!needRefresh) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center p-3 sm:p-4">
      <AlertBanner
        tone="warning"
        className="pointer-events-auto max-w-lg shadow-[var(--shadow-panel)]"
        role="alert"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <p className="min-w-0">{t('pwaUpdateBody')}</p>
          <button
            type="button"
            className="btn-primary shrink-0 self-start px-3 py-1.5 text-xs sm:self-center"
            onClick={() => void updateServiceWorker(true)}
          >
            {t('pwaUpdateReload')}
          </button>
        </div>
      </AlertBanner>
    </div>
  );
}
