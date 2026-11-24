import type { Room } from 'trystero';
import type { FallbackPeerSet } from './fallbackPeerSet';
import type { JoinP2pRoomOptions } from './p2pTypes';

export type P2pOnlineCoordinator = {
  peerFirstSeenAtMs: Map<string, number>;
  /** Ref so fallback peer set can call merge before coordinator is fully wired. */
  mergeOnlineRef: { current: () => void };
  isLiveWebrtc: (userId: string) => boolean;
  readOnlineUserIds: () => string[];
  mergeOnline: () => void;
  noteOnlinePeers: (ids: string[]) => void;
  /**
   * Idempotent WebRTC/presence removal signal for a session.
   * Clears when peer is seen online again via mergeOnline.
   */
  notePeerGone: (userId: string) => void;
  setRoom: (room: Room) => void;
  /** e.g. dm-wrap retry when online candidate set changes. */
  setOnOnlineMerged: (cb: (() => void) | null) => void;
};

export function createP2pOnlineCoordinator(deps: {
  self: { userId: string };
  getFallbackPeers: () => FallbackPeerSet & { map: Map<string, number> };
  onPresenceChange: JoinP2pRoomOptions['onPresenceChange'];
  onPeerPresence: JoinP2pRoomOptions['onPeerPresence'];
}): P2pOnlineCoordinator {
  const peerFirstSeenAtMs = new Map<string, number>();
  const gonePeers = new Set<string>();
  let room: Room | null = null;
  const mergeOnlineRef = { current: () => {} };
  let onOnlineMerged: (() => void) | null = null;

  const noteOnlinePeers = (ids: string[]) => {
    const now = Date.now();
    for (const id of ids) {
      if (!peerFirstSeenAtMs.has(id)) peerFirstSeenAtMs.set(id, now);
      gonePeers.delete(id);
    }
  };

  const isLiveWebrtc = (userId: string): boolean => {
    try {
      if (!room) return false;
      return Object.prototype.hasOwnProperty.call(room.getUsers(), userId);
    } catch {
      return false;
    }
  };

  const readOnlineUserIds = (): string[] => {
    const ids = new Set<string>();
    try {
      if (room) {
        for (const id of Object.keys(room.getUsers())) ids.add(id);
      }
    } catch {
      /* room not ready */
    }
    for (const id of deps.getFallbackPeers().map.keys()) ids.add(id);
    if (deps.self.userId) ids.add(deps.self.userId);
    return [...ids];
  };

  const mergeOnline = () => {
    const ids = readOnlineUserIds();
    noteOnlinePeers(ids);
    deps.onPeerPresence(ids);
    onOnlineMerged?.();
  };
  mergeOnlineRef.current = mergeOnline;

  const notePeerGone = (userId: string) => {
    if (gonePeers.has(userId)) return;
    gonePeers.add(userId);
    deps.getFallbackPeers().deleteQuiet(userId);
    deps.onPresenceChange(userId, null, true);
    mergeOnline();
  };

  return {
    peerFirstSeenAtMs,
    mergeOnlineRef,
    isLiveWebrtc,
    readOnlineUserIds,
    mergeOnline,
    noteOnlinePeers,
    notePeerGone,
    setRoom: (r) => {
      room = r;
    },
    setOnOnlineMerged: (cb) => {
      onOnlineMerged = cb;
    },
  };
}
