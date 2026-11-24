import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { clearRoomCryptoCache } from '../../core/p2p/roomCrypto';
import type { RoomState } from '../roomManagerTypes';
import { bumpJoinToken } from './joinRoom';
import { clearAllSyncTimers, clearSyncTimers, type SyncEngineRefs } from './syncEngine';

/** Shared ceiling for session.leave() during leave/burn (hung leave must not pin forever). */
export const SESSION_LEAVE_TIMEOUT_MS = 15_000;

export function leaveRoomAction(opts: {
  roomId: string;
  roomsRef: MutableRefObject<Map<string, RoomState>>;
  joinTokensRef: MutableRefObject<Map<string, number>>;
  /** Rooms whose session.leave() is still in flight — blocks rejoin overlap. */
  leavingRoomIdsRef?: MutableRefObject<Set<string>>;
  syncRefs: SyncEngineRefs;
  setRooms: Dispatch<SetStateAction<Map<string, RoomState>>>;
  setActiveRoomId: Dispatch<SetStateAction<string | null>>;
}) {
  const {
    roomId,
    roomsRef,
    joinTokensRef,
    leavingRoomIdsRef,
    syncRefs,
    setRooms,
    setActiveRoomId,
  } = opts;
  const room = roomsRef.current.get(roomId);
  if (!room) return Promise.resolve();
  bumpJoinToken(joinTokensRef, roomId);
  clearSyncTimers(syncRefs, roomId);
  leavingRoomIdsRef?.current.add(roomId);

  // Drop from the map immediately so re-join cannot fast-path a half-left session.
  const next = new Map(roomsRef.current);
  next.delete(roomId);
  roomsRef.current = next;
  setRooms(next);
  setActiveRoomId((cur) => {
    if (cur !== roomId) return cur;
    return [...next.keys()][0] ?? null;
  });

  return (async () => {
    try {
      // Block rejoin until leave settles; 15s ceiling so a hung leave cannot pin forever.
      await Promise.race([
        room.session.leave().catch(() => {
          /* ignore — room already removed from UI state */
        }),
        new Promise<void>((resolve) => window.setTimeout(resolve, SESSION_LEAVE_TIMEOUT_MS)),
      ]);
    } finally {
      leavingRoomIdsRef?.current.delete(roomId);
      clearRoomCryptoCache(roomId);
    }
  })();
}

export async function burnSessionAction(opts: {
  roomsRef: MutableRefObject<Map<string, RoomState>>;
  joinTokensRef: MutableRefObject<Map<string, number>>;
  joinGenerationRef: MutableRefObject<number>;
  isJoiningRef: MutableRefObject<boolean>;
  pendingJoinRef: MutableRefObject<unknown>;
  leavingRoomIdsRef?: MutableRefObject<Set<string>>;
  syncRefs: SyncEngineRefs;
  setRooms: Dispatch<SetStateAction<Map<string, RoomState>>>;
  setActiveRoomId: Dispatch<SetStateAction<string | null>>;
  setIsJoining: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    roomsRef,
    joinTokensRef,
    joinGenerationRef,
    isJoiningRef,
    pendingJoinRef,
    leavingRoomIdsRef,
    syncRefs,
    setRooms,
    setActiveRoomId,
    setIsJoining,
  } = opts;

  for (const id of joinTokensRef.current.keys()) bumpJoinToken(joinTokensRef, id);
  clearAllSyncTimers(syncRefs);
  joinTokensRef.current.clear();
  pendingJoinRef.current = null;
  joinGenerationRef.current += 1;
  isJoiningRef.current = false;

  const sessions = [...roomsRef.current.entries()];
  for (const [id] of sessions) {
    leavingRoomIdsRef?.current.add(id);
  }
  roomsRef.current = new Map();
  setRooms(new Map());
  setActiveRoomId(null);
  setIsJoining(false);

  try {
    const leaveAll = Promise.allSettled(sessions.map(([, room]) => room.session.leave()));
    await Promise.race([
      leaveAll,
      new Promise<void>((resolve) => window.setTimeout(resolve, SESSION_LEAVE_TIMEOUT_MS)),
    ]);
  } finally {
    for (const [id] of sessions) {
      leavingRoomIdsRef?.current.delete(id);
    }
    clearRoomCryptoCache();
  }

  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem('tazia-burn-notice', '1');
  } catch {
    /* ignore */
  }
  try {
    window.location.reload();
  } catch {
    try {
      window.location.assign(window.location.href);
    } catch {
      /* embedded / blocked navigation — user must refresh manually */
    }
  }
}

/** Debounced visibility/online transport nudge (does not flip isSyncing UI). */
export function attachVisibilitySync(roomsRef: MutableRefObject<Map<string, RoomState>>) {
  let debounce: number | null = null;
  const kick = () => {
    if (debounce !== null) window.clearTimeout(debounce);
    debounce = window.setTimeout(() => {
      debounce = null;
      for (const room of roomsRef.current.values()) {
        void room.session
          .nudgeTransport()
          .then(() => room.session.requestSyncFromPeers())
          .catch(() => {
            /* ignore */
          });
      }
    }, 900);
  };
  const onVis = () => {
    if (document.visibilityState === 'visible') kick();
  };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('online', kick);
  return () => {
    if (debounce !== null) window.clearTimeout(debounce);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('online', kick);
  };
}
