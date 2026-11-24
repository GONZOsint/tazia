/** Re-export core network prefs for UI / AppOverlays. Hooks import core directly. */
export {
  NOSTR_RELAY_SS_KEY,
  NOSTR_RELAY_LS_KEY,
  NETWORK_PREFS_CLEARED_EVENT,
  type NostrRelayConfig,
  isAllowedNostrRelayUrl,
  splitNostrRelayUrls,
  sanitizeNostrRelayConfig,
  emitNetworkPrefsCleared,
  buildNostrRelayUrls,
  loadNostrRelayConfig,
  saveNostrRelayConfig,
  hasPersistedNostrRelayConfig,
  clearPersistedNostrRelayConfig,
  clearNostrRelayConfig,
} from '../../core/net/nostrRelayConfig';
