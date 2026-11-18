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
  /** Native SubtleCrypto Ed25519 (else we use @noble/ed25519). */
  nativeEd25519: boolean | null;
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

/**
 * Sync baseline — enough to decide whether to block the UI before async Ed25519 probe.
 */
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
    nativeEd25519: null,
    localNetworkPermissionApi: hasLocalNetworkPermissionApi(),
    reasons,
  };
}

export async function probeBrowserSupport(): Promise<BrowserSupportReport> {
  const base = probeBrowserSupportSync();
  if (base.level === 'blocked') return base;

  let nativeEd25519 = false;
  try {
    const { supportsNativeEd25519 } = await import('../crypto/messageSigning');
    nativeEd25519 = await supportsNativeEd25519();
  } catch {
    nativeEd25519 = false;
  }

  return {
    ...base,
    nativeEd25519,
    // Noble fallback keeps signing working; still "ok".
    level: 'ok',
  };
}
