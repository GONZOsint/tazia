import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import {
  NETWORK_PREFS_CLEARED_EVENT,
  buildNostrRelayUrls,
  loadNostrRelayConfig,
  saveNostrRelayConfig,
  type NostrRelayConfig,
} from './nostrRelayConfig';

/** Custom Nostr relay list — lives inside Zones → Fix. */
export function NostrRelaySettings() {
  const t = useT();
  const [config, setConfig] = useState<NostrRelayConfig>(loadNostrRelayConfig);
  /** Keep editor open while typing before the first valid wss:// (sanitize may clear enabled). */
  const [editorOpen, setEditorOpen] = useState(() => loadNostrRelayConfig().enabled);
  const activeUrls = buildNostrRelayUrls(config);
  const showFields = editorOpen || config.enabled;

  const update = (patch: Partial<NostrRelayConfig>) => {
    const safe = saveNostrRelayConfig({ ...config, ...patch });
    setConfig(safe);
  };

  useEffect(() => {
    const reload = () => {
      const next = loadNostrRelayConfig();
      setConfig(next);
      // TURN clear emits the same event — keep an open draft editor mounted.
      setEditorOpen((was) => next.enabled || was);
    };
    window.addEventListener(NETWORK_PREFS_CLEARED_EVENT, reload);
    return () => window.removeEventListener(NETWORK_PREFS_CLEARED_EVENT, reload);
  }, []);

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="type-label text-ink">{t('nostrRelayTitle')}</p>
      <p className="type-caption">{t('nostrRelayHint')}</p>

      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-xs text-ink">
        <span className="relative inline-flex">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={showFields}
            onChange={(e) => {
              const on = e.target.checked;
              setEditorOpen(on);
              if (!on) update({ enabled: false });
            }}
          />
          <span
            className="tazia-check peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
            data-checked={showFields}
            aria-hidden="true"
          >
            <svg className="h-3 w-3 text-on-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
        <span>{t('nostrRelayEnabled')}</span>
      </label>

      {showFields && (
        <div className="space-y-3">
          <div>
            <label htmlFor="nostr-relay-urls" className="type-label text-ink">
              {t('nostrRelayUrls')}
            </label>
            <textarea
              id="nostr-relay-urls"
              value={config.urlsText}
              onChange={(e) => update({ enabled: true, urlsText: e.target.value })}
              placeholder={'wss://relay.example.com\nwss://relay2.example.com'}
              rows={3}
              className="input-base mt-1 font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
              data-1p-ignore="true"
              data-lpignore="true"
            />
            <p className="type-caption mt-1">{t('nostrRelayUrlsHint')}</p>
          </div>

          {activeUrls ? (
            <p
              className="type-caption rounded-[var(--radius-ctrl)] border border-accent/30 bg-accent-soft px-3 py-2 text-ink"
              role="status"
            >
              {t('nostrRelayActive', { n: activeUrls.length })}
            </p>
          ) : (
            <p
              className="type-caption rounded-[var(--radius-ctrl)] border border-warn-border bg-warn-bg/50 px-3 py-2 text-warn-ink"
              role="status"
            >
              {t('nostrRelayNeedUrls')}
            </p>
          )}

          <p className="type-caption">{t('nostrRelayOperatorSeesIp')}</p>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-xs text-ink">
            <span className="relative inline-flex">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={config.rememberDevice}
                onChange={(e) => update({ rememberDevice: e.target.checked, enabled: true })}
              />
              <span
                className="tazia-check peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                data-checked={config.rememberDevice}
                aria-hidden="true"
              >
                <svg className="h-3 w-3 text-on-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
            <span>{t('nostrRelayRememberDevice')}</span>
          </label>
          <p className="type-caption">{t('nostrRelayRememberDeviceHint')}</p>
        </div>
      )}
    </div>
  );
}
