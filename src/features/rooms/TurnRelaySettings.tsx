import { useEffect, useState } from 'react';
import { ChevronDown, Shield } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';

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
      iceCandidatePoolSize: 10,
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
      className={`mt-5 rounded-xl border p-4 ${
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
          <Shield className="h-3.5 w-3.5" aria-hidden="true" />
          {t('turnRelayTitle')}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-3">
              <p className="text-[11px] text-muted">{t('turnRelayHint')}</p>

              <label className="flex min-h-[44px] items-center gap-3 text-xs text-ink">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded accent-accent"
                  checked={config.enabled}
                  onChange={(e) =>
                    update({
                      enabled: e.target.checked,
                      ...(e.target.checked ? {} : { relayOnly: false }),
                    })
                  }
                />
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
                      className="mt-1 w-full min-h-[44px] rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-[16px] text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-accent/30"
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
                      className="mt-1 w-full min-h-[44px] rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-[16px] text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-accent/30"
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
                      className="mt-1 w-full min-h-[44px] rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-[16px] text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>

                  <label className="flex min-h-[44px] items-center gap-3 text-xs text-ink">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded accent-accent"
                      checked={config.relayOnly}
                      onChange={(e) => update({ relayOnly: e.target.checked })}
                    />
                    <span>{t('turnForceRelay')}</span>
                  </label>
                  <p className="text-[11px] text-muted">{t('turnForceRelayHint')}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
