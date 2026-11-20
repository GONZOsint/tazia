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

/** Hard ceiling so a hung peer sync cannot leave meshStatus stuck on syncing. */
export const SYNC_REQUEST_TIMEOUT_MS = 15_000;

export async function runSync(refs: SyncEngineRefs, roomId: string) {
  const room = refs.roomsRef.current.get(roomId);
  if (!room || refs.syncInFlightRef.current.has(roomId)) return;
  refs.syncInFlightRef.current.add(roomId);
  refs.updateRoom(roomId, (r) => ({ ...r, isSyncing: true }));
  try {
    await Promise.race([
      room.session.requestSyncFromPeers(),
      new Promise<void>((_, reject) =>
        window.setTimeout(() => reject(new Error('sync-timeout')), SYNC_REQUEST_TIMEOUT_MS)
      ),
    ]);
    const forumFocusedHere =
      refs.forumFocusedRef?.current === true && roomId === refs.activeRoomIdRef.current;
    refs.updateRoom(roomId, (r) => {
      if (forumFocusedHere) {
        return {
          ...r,
          isSyncing: false,
          rejectedSyncCount: r.session.getRejectedSyncCount(),
          unreadCount: 0,
        };
      }
      // Recompute: recent non-self content while away (covers live posts gated during isSyncing).
      const recentUnread = r.messages.reduce((n, m) => {
        if (m.authorUserId === r.selfUserId) return n;
        if (m.type === 'DELETE_VOTE' || m.type === 'DELETE_PROPOSE') return n;
        if (Date.now() - m.createdAtMs >= 90_000) return n;
        return n + 1;
      }, 0);
      return {
        ...r,
        isSyncing: false,
        rejectedSyncCount: r.session.getRejectedSyncCount(),
        unreadCount: Math.max(r.unreadCount, recentUnread),
      };
    });
  } catch {
    refs.updateRoom(roomId, (r) => ({
      ...r,
      isSyncing: false,
      rejectedSyncCount: r.session.getRejectedSyncCount(),
    }));
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
