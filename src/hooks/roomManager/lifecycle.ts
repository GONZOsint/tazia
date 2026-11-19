import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { RoomState } from '../roomManagerTypes';
import { bumpJoinToken } from './joinRoom';
import { clearAllSyncTimers, clearSyncTimers, type SyncEngineRefs } from './syncEngine';

export function leaveRoomAction(opts: {
  roomId: string;
  roomsRef: MutableRefObject<Map<string, RoomState>>;
  joinTokensRef: MutableRefObject<Map<string, number>>;
  syncRefs: SyncEngineRefs;
  setRooms: Dispatch<SetStateAction<Map<string, RoomState>>>;
  setActiveRoomId: Dispatch<SetStateAction<string | null>>;
}) {
  const { roomId, roomsRef, joinTokensRef, syncRefs, setRooms, setActiveRoomId } = opts;
  const room = roomsRef.current.get(roomId);
  if (!room) return Promise.resolve();
  bumpJoinToken(joinTokensRef, roomId);
  clearSyncTimers(syncRefs, roomId);
  return (async () => {
    try {
      await room.session.leave();
    } catch {
      /* ignore */
    }
    const next = new Map(roomsRef.current);
    next.delete(roomId);
    roomsRef.current = next;
    setRooms(next);
    setActiveRoomId((cur) => {
      if (cur !== roomId) return cur;
      return [...next.keys()][0] ?? null;
    });
  })();
}

export async function burnSessionAction(opts: {
  roomsRef: MutableRefObject<Map<string, RoomState>>;
  joinTokensRef: MutableRefObject<Map<string, number>>;
  joinGenerationRef: MutableRefObject<number>;
  isJoiningRef: MutableRefObject<boolean>;
  pendingJoinRef: MutableRefObject<unknown>;
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

  const leaveAll = Promise.allSettled(
    [...roomsRef.current.values()].map((room) => room.session.leave())
  );
  await Promise.race([
    leaveAll,
    new Promise<void>((resolve) => window.setTimeout(resolve, 2_000)),
  ]);

  roomsRef.current = new Map();
  setRooms(new Map());
  setActiveRoomId(null);
  setIsJoining(false);
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
  window.location.reload();
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
