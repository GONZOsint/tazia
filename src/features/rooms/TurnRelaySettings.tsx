import { useEffect, useState } from 'react';
import { ChevronDown, Wrench } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { NETWORK_PREFS_CLEARED_EVENT } from '../../core/net/nostrRelayConfig';
import {
  type TurnConfig,
  buildRtcConfig,
  loadTurnConfig,
  saveTurnConfig,
} from '../../core/net/turnConfig';
import { useT } from '../../i18n';
import { disclosure } from '../../motion/tokens';
import { NostrRelaySettings } from './NostrRelaySettings';

export type { TurnConfig } from '../../core/net/turnConfig';
export {
  buildRtcConfig,
  loadTurnConfig,
  hasPersistedTurnConfig,
  clearPersistedTurnConfig,
  clearTurnConfig,
} from '../../core/net/turnConfig';

interface TurnRelaySettingsProps {
  /** When true, expand the panel (e.g. after ICE / peer-connect failure). */
  forceOpen?: boolean;
}

export function TurnRelaySettings({ forceOpen = false }: TurnRelaySettingsProps) {
  const t = useT();
  const [open, setOpen] = useState(forceOpen);
  const [techOpen, setTechOpen] = useState(false);
  const [config, setConfig] = useState<TurnConfig>(loadTurnConfig);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  useEffect(() => {
    const openFromHash = () => {
      if (location.hash === '#turn-relay-settings' || location.hash === '#fix') {
        setOpen(true);
      }
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    const onOpenFix = () => setOpen(true);
    window.addEventListener('tazia:open-fix', onOpenFix);
    return () => {
      window.removeEventListener('hashchange', openFromHash);
      window.removeEventListener('tazia:open-fix', onOpenFix);
    };
  }, []);

  const update = (patch: Partial<TurnConfig>) => {
    const safe = saveTurnConfig({ ...config, ...patch });
    setConfig(safe);
  };

  useEffect(() => {
    const reload = () => setConfig(loadTurnConfig());
    window.addEventListener(NETWORK_PREFS_CLEARED_EVENT, reload);
    return () => window.removeEventListener(NETWORK_PREFS_CLEARED_EVENT, reload);
  }, []);

  const { relayOnly: iceRelayOnly } = buildRtcConfig(config);

  return (
    <div
      id="turn-relay-settings"
      className={`mt-5 rounded-[var(--radius-panel)] border p-4 ${
        forceOpen ? 'border-warn-border bg-warn-bg/40' : 'border-border bg-bg'
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[44px] items-center justify-between gap-2 text-xs font-semibold text-muted focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="flex items-center gap-2">
          <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
          {t('turnFixCta')}
          <span className="font-normal text-faint">· {t('turnRelayTitle')}</span>
        </span>
        <ChevronDown
          className={`chevron-spin h-3.5 w-3.5 ${open ? 'is-open' : ''}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={disclosure.initial}
            animate={disclosure.animate}
            exit={disclosure.exit}
            transition={disclosure.transition}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-3">
              <p className="type-caption">{t('turnRelayHint')}</p>

              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-xs text-ink">
                <span className="relative inline-flex">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={config.enabled}
                    onChange={(e) =>
                      update({
                        enabled: e.target.checked,
                        // Privacy default: hide peer-facing IP when TURN is on (LAN P2P → uncheck).
                        relayOnly: e.target.checked ? true : false,
                      })
                    }
                  />
                  <span
                    className="tazia-check peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                    data-checked={config.enabled}
                    aria-hidden="true"
                  >
                    <svg className="h-3 w-3 text-on-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </span>
                <span>{t('turnRelayEnabled')}</span>
              </label>

              {config.enabled && (
                <div className="space-y-3">
                  <p
                    className={`type-caption rounded-[var(--radius-ctrl)] border px-3 py-2 ${
                      iceRelayOnly
                        ? 'border-accent/30 bg-accent-soft text-ink'
                        : 'border-warn-border bg-warn-bg/50 text-warn-ink'
                    }`}
                    role="status"
                  >
                    {iceRelayOnly ? t('turnIpStatusRelay') : t('turnIpStatusP2p')}
                  </p>
                  <p className="type-caption">{t('turnOperatorSeesIp')}</p>
                  <div>
                    <label htmlFor="turn-url" className="type-label text-ink">
                      {t('turnServerUrl')}
                    </label>
                    <input
                      id="turn-url"
                      value={config.url}
                      onChange={(e) => update({ url: e.target.value })}
                      placeholder="turn:turn.example.com:3478"
                      className="input-base mt-1 font-mono text-xs"
                      autoComplete="off"
                      spellCheck={false}
                      data-1p-ignore="true"
                      data-lpignore="true"
                    />
                  </div>
                  <div>
                    <label htmlFor="turn-user" className="type-label text-ink">
                      {t('turnUsername')}
                    </label>
                    <input
                      id="turn-user"
                      value={config.username}
                      onChange={(e) => update({ username: e.target.value })}
                      className="input-base mt-1"
                      autoComplete="off"
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-form-type="other"
                    />
                  </div>
                  <div>
                    <label htmlFor="turn-cred" className="type-label text-ink">
                      {t('turnCredential')}
                    </label>
                    <input
                      id="turn-cred"
                      type="password"
                      value={config.credential}
                      onChange={(e) => update({ credential: e.target.value })}
                      className="input-base mt-1"
                      autoComplete="off"
                      data-1p-ignore="true"
                      data-lpignore="true"
                      data-form-type="other"
                      name="turn-relay-credential"
                    />
                  </div>

                  {forceOpen && !config.relayOnly ? (
                    <p className="type-caption rounded-[var(--radius-ctrl)] border border-warn-border bg-warn-bg/50 px-3 py-2 text-warn-ink">
                      {t('turnHideIpPrompt')}
                    </p>
                  ) : null}

                  <label
                    className={`flex min-h-[44px] cursor-pointer items-center gap-3 text-xs text-ink ${
                      forceOpen && !config.relayOnly
                        ? 'rounded-[var(--radius-ctrl)] border border-accent/40 bg-accent-soft px-3 py-2'
                        : ''
                    }`}
                  >
                    <span className="relative inline-flex">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={config.relayOnly}
                        onChange={(e) => update({ relayOnly: e.target.checked })}
                      />
                      <span
                        className="tazia-check peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                        data-checked={config.relayOnly}
                        aria-hidden="true"
                      >
                        <svg className="h-3 w-3 text-on-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </span>
                    <span>{t('turnForceRelay')}</span>
                  </label>
                  <p className="type-caption">{t('turnForceRelayHint')}</p>

                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-xs text-ink">
                    <span className="relative inline-flex">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={config.rememberDevice}
                        onChange={(e) => update({ rememberDevice: e.target.checked })}
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
                    <span>{t('turnRememberDevice')}</span>
                  </label>
                  <p className="type-caption">{t('turnRememberDeviceHint')}</p>
                </div>
              )}

              <div className="rounded-[var(--radius-ctrl)] border border-dashed border-border px-3 py-2">
                <button
                  type="button"
                  aria-expanded={techOpen}
                  onClick={() => setTechOpen((v) => !v)}
                  className="type-label min-h-[36px] text-left text-muted underline-offset-2 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {techOpen ? t('helpMoreHide') : t('helpMore')}
                </button>
                {techOpen && (
                  <p className="type-caption mt-2 font-mono leading-relaxed text-faint whitespace-pre-line">
                    {t('turnTechNote')}
                  </p>
                )}
              </div>

              <NostrRelaySettings />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
