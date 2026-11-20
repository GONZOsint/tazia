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

function sameDmUnread(
  a: RoomState['dmUnread'],
  b: RoomState['dmUnread']
): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Fields the zone list / nav badges read for non-active rooms.
 * Message/presence body churn on background zones can skip React commits.
 */
export function roomListChromeEqual(a: RoomState, b: RoomState): boolean {
  return (
    a.unreadCount === b.unreadCount &&
    a.meshStatus === b.meshStatus &&
    a.relayFallbackActive === b.relayFallbackActive &&
    a.selfUserId === b.selfUserId &&
    sameOnlineIdSet(a.onlineUserIds, b.onlineUserIds) &&
    sameDmUnread(a.dmUnread, b.dmUnread)
  );
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
