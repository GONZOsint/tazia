import { useEffect, useState } from 'react';
import { ChevronDown, Wrench } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { disclosure } from '../../motion/tokens';

const LS_KEY = 'tazia:turn-config';

export interface TurnConfig {
  /** Use TURN as ICE fallback when direct/STUN fails (fixes CGNAT). */
  enabled: boolean;
  /** Force iceTransportPolicy: 'relay' (hides IP; needs working TURN). */
  relayOnly: boolean;
  url: string;
  username: string;
  credential: string;
}

const DEFAULT: TurnConfig = {
  enabled: false,
  relayOnly: false,
  url: '',
  username: '',
  credential: '',
};

export function loadTurnConfig(): TurnConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
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
  const hasTurn = turn.enabled && !!turn.url.trim();
  const relayOnly = hasTurn && turn.relayOnly;
  const turnConfig: RTCIceServer[] | undefined = hasTurn
    ? [
        {
          urls: turn.url.trim(),
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

function saveTurnConfig(cfg: TurnConfig): void {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
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

  const update = (patch: Partial<TurnConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveTurnConfig(next);
  };

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
              <p className="text-[11px] text-muted">{t('turnRelayHint')}</p>

              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-xs text-ink">
                <span className="relative inline-flex">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={config.enabled}
                    onChange={(e) =>
                      update({
                        enabled: e.target.checked,
                        ...(e.target.checked ? {} : { relayOnly: false }),
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
                  <div>
                    <label htmlFor="turn-url" className="text-[11px] font-semibold text-ink">
                      {t('turnServerUrl')}
                    </label>
                    <input
                      id="turn-url"
                      value={config.url}
                      onChange={(e) => update({ url: e.target.value })}
                      placeholder="turn:turn.example.com:3478"
                      className="input-base mt-1 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="turn-user" className="text-[11px] font-semibold text-ink">
                      {t('turnUsername')}
                    </label>
                    <input
                      id="turn-user"
                      value={config.username}
                      onChange={(e) => update({ username: e.target.value })}
                      className="input-base mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="turn-cred" className="text-[11px] font-semibold text-ink">
                      {t('turnCredential')}
                    </label>
                    <input
                      id="turn-cred"
                      type="password"
                      value={config.credential}
                      onChange={(e) => update({ credential: e.target.value })}
                      className="input-base mt-1"
                    />
                  </div>

                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-xs text-ink">
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
                  <p className="text-[11px] text-muted">{t('turnForceRelayHint')}</p>
                </div>
              )}

              <div className="rounded-[var(--radius-ctrl)] border border-dashed border-border px-3 py-2">
                <button
                  type="button"
                  aria-expanded={techOpen}
                  onClick={() => setTechOpen((v) => !v)}
                  className="min-h-[36px] text-left text-[11px] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {techOpen ? t('helpMoreHide') : t('helpMore')}
                </button>
                {techOpen && (
                  <p className="mt-2 font-mono text-[10px] leading-relaxed text-faint whitespace-pre-line">
                    {t('turnTechNote')}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
