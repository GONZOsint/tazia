import { emitNetworkPrefsCleared } from './nostrRelayConfig';

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

export function isAllowedTurnUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.startsWith('turn:') || u.startsWith('turns:');
}

/** Reject non-TURN schemes (http/ws/…); allow incomplete typing until a scheme appears. */
function isDisallowedTurnUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u || !u.includes(':')) return false;
  return !isAllowedTurnUrl(u);
}

export function sanitizeTurnConfig(partial: Partial<TurnConfig>): TurnConfig {
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

export function saveTurnConfig(cfg: TurnConfig): TurnConfig {
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
