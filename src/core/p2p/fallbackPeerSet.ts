import type { JoinP2pRoomOptions } from './p2pTypes';

export const FALLBACK_PEER_TTL_MS = 45_000;

export interface FallbackPeerSet {
  touch: (userId: string) => void;
  drop: (userId: string) => void;
  deleteQuiet: (userId: string) => void;
  pruneStale: (isLiveWebrtc: (userId: string) => boolean) => boolean;
}

export function createFallbackPeerSet(
  self: { userId: string },
  onPresenceChange: JoinP2pRoomOptions['onPresenceChange'],
  mergeOnline: () => void
): FallbackPeerSet & { map: Map<string, number> } {
  const map = new Map<string, number>();

  return {
    map,
    touch(userId: string) {
      if (userId === self.userId) return;
      map.set(userId, Date.now());
      mergeOnline();
    },
    drop(userId: string) {
      if (!map.has(userId)) return;
      map.delete(userId);
      onPresenceChange(userId, null, true);
      mergeOnline();
    },
    deleteQuiet(userId: string) {
      map.delete(userId);
    },
    pruneStale(isLiveWebrtc) {
      const now = Date.now();
      let pruned = false;
      for (const [id, at] of map) {
        if (now - at <= FALLBACK_PEER_TTL_MS) continue;
        map.delete(id);
        pruned = true;
        // Never fire removed while peer is still live on WebRTC.
        if (!isLiveWebrtc(id)) {
          onPresenceChange(id, null, true);
        }
      }
      return pruned;
    },
  };
}
