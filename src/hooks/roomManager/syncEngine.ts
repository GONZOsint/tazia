import type { MutableRefObject } from 'react';
import type { RoomState } from '../roomManagerTypes';

export const POST_JOIN_SYNC_DELAYS_MS = [800, 2500, 6000] as const;

export type SyncEngineRefs = {
  roomsRef: MutableRefObject<Map<string, RoomState>>;
  activeRoomIdRef: MutableRefObject<string | null>;
  forumFocusedRef?: MutableRefObject<boolean>;
  syncTimersRef: MutableRefObject<Map<string, number[]>>;
  syncInFlightRef: MutableRefObject<Set<string>>;
  updateRoom: (roomId: string, updater: (prev: RoomState) => RoomState) => void;
};

export function clearSyncTimers(refs: SyncEngineRefs, roomId: string) {
  const timers = refs.syncTimersRef.current.get(roomId);
  if (!timers) return;
  for (const id of timers) window.clearTimeout(id);
  refs.syncTimersRef.current.delete(roomId);
  refs.syncInFlightRef.current.delete(roomId);
}

export function clearAllSyncTimers(refs: SyncEngineRefs) {
  for (const id of [...refs.syncTimersRef.current.keys()]) {
    clearSyncTimers(refs, id);
  }
}

export async function runSync(refs: SyncEngineRefs, roomId: string) {
  const room = refs.roomsRef.current.get(roomId);
  if (!room || refs.syncInFlightRef.current.has(roomId)) return;
  refs.syncInFlightRef.current.add(roomId);
  refs.updateRoom(roomId, (r) => ({ ...r, isSyncing: true }));
  try {
    await room.session.requestSyncFromPeers();
    refs.updateRoom(roomId, (r) => ({
      ...r,
      isSyncing: false,
      rejectedSyncCount: r.session.getRejectedSyncCount(),
      unreadCount:
        refs.forumFocusedRef?.current === true && roomId === refs.activeRoomIdRef.current
          ? 0
          : r.unreadCount,
    }));
  } catch {
    refs.updateRoom(roomId, (r) => ({ ...r, isSyncing: false }));
  } finally {
    refs.syncInFlightRef.current.delete(roomId);
  }
}

export function schedulePostJoinSync(refs: SyncEngineRefs, roomId: string) {
  clearSyncTimers(refs, roomId);
  const timers: number[] = [];
  for (const delayMs of POST_JOIN_SYNC_DELAYS_MS) {
    timers.push(
      window.setTimeout(() => {
        void runSync(refs, roomId);
      }, delayMs)
    );
  }
  refs.syncTimersRef.current.set(roomId, timers);
}
