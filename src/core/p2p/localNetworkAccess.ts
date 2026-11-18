/**
 * Chrome/Edge Local Network Access (LNA) gates public→LAN WebRTC.
 * GitHub Pages is a public origin; same-LAN P2P needs host/.local candidates.
 * @see https://developer.chrome.com/blog/local-network-access
 * @see https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access
 */

export type LocalNetworkPermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported';

export async function queryLocalNetworkAccess(): Promise<LocalNetworkPermissionState> {
  try {
    if (!navigator.permissions?.query) return 'unsupported';
    // Spec name; TS DOM lib may lag behind.
    const status = await navigator.permissions.query({
      name: 'local-network' as PermissionName,
    });
    if (status.state === 'granted' || status.state === 'denied' || status.state === 'prompt') {
      return status.state;
    }
    return 'unsupported';
  } catch {
    return 'unsupported';
  }
}

/**
 * Warm ICE under a user gesture so the browser may show the LNA prompt
 * and start gathering host / mDNS candidates before the real room join.
 */
export async function primeLocalNetworkAccess(timeoutMs = 500): Promise<void> {
  if (typeof RTCPeerConnection === 'undefined') return;
  let pc: RTCPeerConnection | null = null;
  try {
    pc = new RTCPeerConnection({
      iceServers: [],
      iceCandidatePoolSize: 8,
    });
    pc.createDataChannel('tazia-lna');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      const t = window.setTimeout(done, timeoutMs);
      pc!.onicecandidate = (ev) => {
        if (ev.candidate === null) {
          window.clearTimeout(t);
          done();
        }
      };
    });
  } catch {
    /* ignore — priming is best-effort */
  } finally {
    try {
      pc?.close();
    } catch {
      /* ignore */
    }
  }
}
