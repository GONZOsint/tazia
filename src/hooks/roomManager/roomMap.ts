import { deriveMeshStatus, type RoomState } from '../roomManagerTypes';

/** Order-independent equality for peer presence id lists. */
export function sameOnlineIdSet(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  const set = new Set(a);
  if (set.size !== b.length) return false;
  for (const id of b) {
    if (!set.has(id)) return false;
  }
  return true;
}

export function applyRoomUpdate(
  prev: Map<string, RoomState>,
  roomId: string,
  updater: (prev: RoomState) => RoomState
): Map<string, RoomState> {
  const existing = prev.get(roomId);
  if (!existing) return prev;
  const updated = updater(existing);
  const meshStatus = deriveMeshStatus(updated);
  const nextRoom =
    meshStatus === updated.meshStatus ? updated : { ...updated, meshStatus };
  if (nextRoom === existing) return prev;
  const next = new Map(prev);
  next.set(roomId, nextRoom);
  return next;
}
