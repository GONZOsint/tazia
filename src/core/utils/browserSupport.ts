/**
 * Runtime capability checks for TAZIA's critical browser APIs.
 * Targets: Chrome, Brave (Chromium), Firefox, Safari (desktop + iOS WebKit).
 */

export type BrowserSupportLevel = 'ok' | 'degraded' | 'blocked';

export interface BrowserSupportReport {
  level: BrowserSupportLevel;
  secureContext: boolean;
  webRtc: boolean;
  webCrypto: boolean;
  webSocket: boolean;
  /** Chrome/Edge/Brave Local Network Access permission API. */
  localNetworkPermissionApi: boolean;
  reasons: string[];
}

function hasWebRtc(): boolean {
  return typeof RTCPeerConnection !== 'undefined';
}

function hasWebCrypto(): boolean {
  return typeof crypto !== 'undefined' && Boolean(crypto.subtle) && Boolean(crypto.getRandomValues);
}

function hasWebSocket(): boolean {
  return typeof WebSocket !== 'undefined';
}

function hasLocalNetworkPermissionApi(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.permissions?.query === 'function';
}

/** Baseline capability check used before room entry. */
export function probeBrowserSupportSync(): BrowserSupportReport {
  const secureContext =
    typeof window !== 'undefined'
      ? window.isSecureContext
      : typeof location !== 'undefined' &&
        (location.protocol === 'https:' ||
          location.hostname === 'localhost' ||
          location.hostname === '127.0.0.1');
  const webRtc = hasWebRtc();
  const webCrypto = hasWebCrypto();
  const webSocket = hasWebSocket();
  const reasons: string[] = [];

  if (!secureContext) reasons.push('insecure-context');
  if (!webRtc) reasons.push('webrtc');
  if (!webCrypto) reasons.push('webcrypto');
  if (!webSocket) reasons.push('websocket');

  let level: BrowserSupportLevel = 'ok';
  if (!secureContext || !webRtc || !webCrypto || !webSocket) level = 'blocked';

  return {
    level,
    secureContext,
    webRtc,
    webCrypto,
    webSocket,
    localNetworkPermissionApi: hasLocalNetworkPermissionApi(),
    reasons,
  };
}
