import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  NOSTR_RELAY_LS_KEY,
  NOSTR_RELAY_SS_KEY,
  buildNostrRelayUrls,
  clearNostrRelayConfig,
  isAllowedNostrRelayUrl,
  loadNostrRelayConfig,
  sanitizeNostrRelayConfig,
  saveNostrRelayConfig,
  splitNostrRelayUrls,
} from './nostrRelayConfig';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: memoryStorage(),
    configurable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage(),
    configurable: true,
  });
});

afterEach(() => {
  clearNostrRelayConfig();
});

describe('isAllowedNostrRelayUrl', () => {
  it('accepts wss only', () => {
    expect(isAllowedNostrRelayUrl('wss://relay.example.com')).toBe(true);
    expect(isAllowedNostrRelayUrl('WSS://relay.example.com/path')).toBe(true);
    expect(isAllowedNostrRelayUrl('ws://relay.example.com')).toBe(false);
    expect(isAllowedNostrRelayUrl('https://relay.example.com')).toBe(false);
    expect(isAllowedNostrRelayUrl('turn:example.com:3478')).toBe(false);
  });
});

describe('sanitizeNostrRelayConfig', () => {
  it('strips disallowed schemes but keeps in-progress lines', () => {
    const safe = sanitizeNostrRelayConfig({
      enabled: true,
      urlsText: 'wss://a.example\nws://bad.example\nwss://b.example\ninprogress',
      rememberDevice: false,
    });
    expect(safe.enabled).toBe(true);
    expect(safe.urlsText).toContain('wss://a.example');
    expect(safe.urlsText).toContain('wss://b.example');
    expect(safe.urlsText).toContain('inprogress');
    expect(safe.urlsText).not.toContain('ws://bad.example');
  });

  it('forces enabled false without a valid wss URL', () => {
    expect(
      sanitizeNostrRelayConfig({
        enabled: true,
        urlsText: '',
        rememberDevice: false,
      }).enabled
    ).toBe(false);
    expect(
      sanitizeNostrRelayConfig({
        enabled: true,
        urlsText: 'inprogress\nws://nope',
        rememberDevice: false,
      }).enabled
    ).toBe(false);
  });
});

describe('splitNostrRelayUrls / buildNostrRelayUrls', () => {
  it('splits on whitespace and commas', () => {
    expect(splitNostrRelayUrls('wss://a.com, wss://b.com\nwss://c.com')).toEqual([
      'wss://a.com',
      'wss://b.com',
      'wss://c.com',
    ]);
  });

  it('returns undefined when disabled or empty', () => {
    expect(buildNostrRelayUrls({ enabled: false, urlsText: 'wss://a.com', rememberDevice: false })).toBeUndefined();
    expect(buildNostrRelayUrls({ enabled: true, urlsText: '', rememberDevice: false })).toBeUndefined();
    expect(buildNostrRelayUrls({ enabled: true, urlsText: 'ws://nope', rememberDevice: false })).toBeUndefined();
  });

  it('dedupes valid wss urls when enabled', () => {
    expect(
      buildNostrRelayUrls({
        enabled: true,
        urlsText: 'wss://a.com\nwss://a.com\nwss://b.com',
        rememberDevice: false,
      })
    ).toEqual(['wss://a.com', 'wss://b.com']);
  });
});

describe('persist round-trip', () => {
  it('saves to session and optional localStorage', () => {
    saveNostrRelayConfig({
      enabled: true,
      urlsText: 'wss://relay.example.com',
      rememberDevice: true,
    });
    expect(sessionStorage.getItem(NOSTR_RELAY_SS_KEY)).toBeTruthy();
    expect(localStorage.getItem(NOSTR_RELAY_LS_KEY)).toBeTruthy();
    const loaded = loadNostrRelayConfig();
    expect(loaded.enabled).toBe(true);
    expect(loaded.urlsText).toContain('wss://relay.example.com');
    expect(loaded.rememberDevice).toBe(true);
    expect(buildNostrRelayUrls(loaded)).toEqual(['wss://relay.example.com']);
  });

  it('clearNostrRelayConfig wipes session and persist', () => {
    saveNostrRelayConfig({
      enabled: true,
      urlsText: 'wss://relay.example.com',
      rememberDevice: true,
    });
    clearNostrRelayConfig();
    expect(sessionStorage.getItem(NOSTR_RELAY_SS_KEY)).toBeNull();
    expect(localStorage.getItem(NOSTR_RELAY_LS_KEY)).toBeNull();
    expect(loadNostrRelayConfig().enabled).toBe(false);
  });
});
