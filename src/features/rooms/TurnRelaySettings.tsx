import { useEffect, useState } from 'react';
import { ChevronDown, Wrench } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { disclosure } from '../../motion/tokens';
import {
  NETWORK_PREFS_CLEARED_EVENT,
  emitNetworkPrefsCleared,
} from './nostrRelayConfig';
import { NostrRelaySettings } from './NostrRelaySettings';

/** Session-scoped by default — credentials leave with the tab. */
const SS_KEY = 'tazia:turn-config';
/** Optional durable copy when user opts in to "remember on this device". */
const LS_KEY = 'tazia:turn-config-persist';

export interface TurnConfig {
  /** Use TURN as ICE fallback when direct/STUN fails (fixes CGNAT). */
  enabled: boolean;
  /** Force iceTransportPolicy: 'relay' (hides IP; needs working TURN). */
  relayOnly: boolean;
  url: string;
  username: string;
  credential: string;
  /** Persist URL/creds to localStorage across sessions. */
  rememberDevice: boolean;
}

const DEFAULT: TurnConfig = {
  enabled: false,
  relayOnly: false,
  url: '',
  username: '',
  credential: '',
  rememberDevice: false,
};

function isAllowedTurnUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.startsWith('turn:') || u.startsWith('turns:');
}

/** Reject non-TURN schemes (http/ws/…); allow incomplete typing until a scheme appears. */
function isDisallowedTurnUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u || !u.includes(':')) return false;
  return !isAllowedTurnUrl(u);
}

function sanitizeTurnConfig(partial: Partial<TurnConfig>): TurnConfig {
  const url = typeof partial.url === 'string' ? partial.url.trim() : '';
  return {
    enabled: Boolean(partial.enabled) && isAllowedTurnUrl(url),
    relayOnly: Boolean(partial.relayOnly),
    url: isDisallowedTurnUrl(url) ? '' : url,
    username: typeof partial.username === 'string' ? partial.username : '',
    credential: typeof partial.credential === 'string' ? partial.credential : '',
    rememberDevice: Boolean(partial.rememberDevice),
  };
}

function parseTurn(raw: string | null): TurnConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TurnConfig>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return sanitizeTurnConfig({ ...DEFAULT, ...parsed });
  } catch {
    return null;
  }
}

export function loadTurnConfig(): TurnConfig {
  try {
    const fromSession = parseTurn(sessionStorage.getItem(SS_KEY));
    if (fromSession) return fromSession;
    const fromPersist = parseTurn(localStorage.getItem(LS_KEY));
    if (fromPersist) {
      const remembered = { ...fromPersist, rememberDevice: true };
      sessionStorage.setItem(SS_KEY, JSON.stringify(remembered));
      return remembered;
    }
    return DEFAULT;
  } catch {
    return DEFAULT;
  }
}

/**
 * Build Trystero ICE options.
 * Omit iceServers so Trystero keeps its default STUN list and merges turnConfig.
 * iceCandidatePoolSize warms gathering while signaling runs (faster LAN/WAN join).
 * iceTransportPolicy stays 'all' unless force-relay — required for same-LAN host candidates on Pages.
 */
export function buildRtcConfig(turn: TurnConfig = loadTurnConfig()): {
  rtcConfig: RTCConfiguration;
  turnConfig?: RTCIceServer[];
  relayOnly: boolean;
} {
  const url = turn.url.trim();
  const hasTurn = turn.enabled && !!url && isAllowedTurnUrl(url);
  const relayOnly = hasTurn && turn.relayOnly;
  const turnConfig: RTCIceServer[] | undefined = hasTurn
    ? [
        {
          urls: url,
          username: turn.username || undefined,
          credential: turn.credential || undefined,
        },
      ]
    : undefined;

  return {
    rtcConfig: {
      iceCandidatePoolSize: 8,
      iceTransportPolicy: relayOnly ? 'relay' : 'all',
    },
    turnConfig,
    relayOnly,
  };
}

function saveTurnConfig(cfg: TurnConfig): TurnConfig {
  const safe = sanitizeTurnConfig(cfg);
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(safe));
    if (safe.rememberDevice) {
      localStorage.setItem(LS_KEY, JSON.stringify(safe));
    } else {
      clearPersistedTurnConfig();
    }
  } catch {
    /* private mode / quota */
  }
  return safe;
}

/** True when opt-in TURN JSON is still on this device (survives tab close / default burn). */
export function hasPersistedTurnConfig(): boolean {
  try {
    return Boolean(localStorage.getItem(LS_KEY));
  } catch {
    return false;
  }
}

/** Drop remembered TURN credentials from localStorage. */
export function clearPersistedTurnConfig(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* private mode */
  }
}

/** Drop session + persisted TURN (Help forget / burn prefs). */
export function clearTurnConfig(opts?: { emitCleared?: boolean }): void {
  try {
    sessionStorage.removeItem(SS_KEY);
  } catch {
    /* private mode */
  }
  clearPersistedTurnConfig();
  if (opts?.emitCleared !== false) emitNetworkPrefsCleared();
}

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
