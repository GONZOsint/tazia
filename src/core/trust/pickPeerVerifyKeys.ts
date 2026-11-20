import type { PresenceState } from '../protocol';
import type { TrustStore } from './trustStore';

/** Resolve peer sign+enc keys for SAS display (current → presence → pinned). */
export function pickPeerVerifyKeys(
  trustStore: TrustStore | null | undefined,
  presence: Record<string, PresenceState>,
  userId: string
): { keyB64: string; encB64: string } | null {
  const rec = trustStore?.get(userId);
  const peerPresence = presence[userId];
  const keyB64 =
    rec?.currentKeyB64 ||
    peerPresence?.signPubKeySpkiB64 ||
    rec?.pinnedKeyB64 ||
    '';
  if (!keyB64) return null;
  const encB64 =
    rec?.currentEncRawB64 ||
    peerPresence?.encPubKeyRawB64 ||
    rec?.pinnedEncRawB64 ||
    '';
  return { keyB64, encB64 };
}

/** True when live keys still match the SAS modal snapshot. */
export function peerVerifyKeysMatch(
  snapshot: { keyB64: string; encB64: string },
  live: { keyB64: string; encB64: string } | null
): boolean {
  if (!live) return false;
  return live.keyB64 === snapshot.keyB64 && live.encB64 === snapshot.encB64;
}
