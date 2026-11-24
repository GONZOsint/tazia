/** Session-scoped by default — custom relays leave with the tab. */
export const NOSTR_RELAY_SS_KEY = 'tazia:nostr-relays';
/** Optional durable copy when user opts in to "remember on this device". */
export const NOSTR_RELAY_LS_KEY = 'tazia:nostr-relays-persist';

export interface NostrRelayConfig {
  /** When true and urls are valid, Trystero uses this list instead of defaults. */
  enabled: boolean;
  /** One wss:// URL per line (or comma/space separated when parsed). */
  urlsText: string;
  /** Persist to localStorage across sessions. */
  rememberDevice: boolean;
}

const DEFAULT: NostrRelayConfig = {
  enabled: false,
  urlsText: '',
  rememberDevice: false,
};

/** Accept only encrypted WebSocket relays. */
export function isAllowedNostrRelayUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.startsWith('wss://');
}

function isDisallowedNostrRelayUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u || !u.includes(':')) return false;
  return !isAllowedNostrRelayUrl(u);
}

/** Split textarea / pasted lists into candidate URLs. */
export function splitNostrRelayUrls(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Drop lines with known-bad schemes (ws:/http:); keep in-progress typing. */
export function sanitizeNostrRelayConfig(partial: Partial<NostrRelayConfig>): NostrRelayConfig {
  const rawText = typeof partial.urlsText === 'string' ? partial.urlsText : '';
  const urlsText = rawText
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed || !isDisallowedNostrRelayUrl(trimmed);
    })
    .join('\n');
  const hasValid = splitNostrRelayUrls(urlsText).some(isAllowedNostrRelayUrl);
  return {
    // Match join semantics: custom list is only "on" with at least one wss:// URL.
    enabled: Boolean(partial.enabled) && hasValid,
    urlsText,
    rememberDevice: Boolean(partial.rememberDevice),
  };
}

/** Dispatched after Help forget / burn clears TURN+Nostr prefs so mounted UI can reload. */
export const NETWORK_PREFS_CLEARED_EVENT = 'tazia:network-prefs-cleared';

export function emitNetworkPrefsCleared(): void {
  try {
    window.dispatchEvent(new Event(NETWORK_PREFS_CLEARED_EVENT));
  } catch {
    /* non-DOM */
  }
}

/** Valid wss URLs for Trystero relayConfig.urls, or undefined to keep library defaults. */
export function buildNostrRelayUrls(
  cfg: NostrRelayConfig = loadNostrRelayConfig()
): string[] | undefined {
  if (!cfg.enabled) return undefined;
  const urls = splitNostrRelayUrls(cfg.urlsText).filter(isAllowedNostrRelayUrl);
  return urls.length > 0 ? [...new Set(urls)] : undefined;
}

function parseNostrRelay(raw: string | null): NostrRelayConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<NostrRelayConfig>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return sanitizeNostrRelayConfig({ ...DEFAULT, ...parsed });
  } catch {
    return null;
  }
}

export function loadNostrRelayConfig(): NostrRelayConfig {
  try {
    const fromSession = parseNostrRelay(sessionStorage.getItem(NOSTR_RELAY_SS_KEY));
    if (fromSession) return fromSession;
    const fromPersist = parseNostrRelay(localStorage.getItem(NOSTR_RELAY_LS_KEY));
    if (fromPersist) {
      const remembered = { ...fromPersist, rememberDevice: true };
      sessionStorage.setItem(NOSTR_RELAY_SS_KEY, JSON.stringify(remembered));
      return remembered;
    }
    return { ...DEFAULT };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveNostrRelayConfig(cfg: NostrRelayConfig): NostrRelayConfig {
  const safe = sanitizeNostrRelayConfig(cfg);
  try {
    sessionStorage.setItem(NOSTR_RELAY_SS_KEY, JSON.stringify(safe));
    if (safe.rememberDevice) {
      localStorage.setItem(NOSTR_RELAY_LS_KEY, JSON.stringify(safe));
    } else {
      clearPersistedNostrRelayConfig();
    }
  } catch {
    /* private mode / quota */
  }
  return safe;
}

export function hasPersistedNostrRelayConfig(): boolean {
  try {
    return Boolean(localStorage.getItem(NOSTR_RELAY_LS_KEY));
  } catch {
    return false;
  }
}

export function clearPersistedNostrRelayConfig(): void {
  try {
    localStorage.removeItem(NOSTR_RELAY_LS_KEY);
  } catch {
    /* private mode */
  }
}

/** Drop session + persisted custom relay list (Help forget / burn prefs). */
export function clearNostrRelayConfig(opts?: { emitCleared?: boolean }): void {
  try {
    sessionStorage.removeItem(NOSTR_RELAY_SS_KEY);
  } catch {
    /* private mode */
  }
  clearPersistedNostrRelayConfig();
  if (opts?.emitCleared !== false) emitNetworkPrefsCleared();
}
