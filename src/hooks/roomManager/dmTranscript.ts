import type { DirectMessage } from '../../core/protocol';

export function sortDmMessages(a: DirectMessage, b: DirectMessage): number {
  return a.createdAtMs - b.createdAtMs || a.msgId.localeCompare(b.msgId);
}

/** Append a DM if new; returns previous room slice when duplicate. */
export function appendDmMessage(
  prev: DirectMessage[],
  dm: DirectMessage
): DirectMessage[] | null {
  if (prev.some((m) => m.msgId === dm.msgId)) return null;
  return [...prev, dm].sort(sortDmMessages);
}
