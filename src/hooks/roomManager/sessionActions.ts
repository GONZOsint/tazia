import type { MutableRefObject } from 'react';
import { P2pActionError } from '../../core/p2p/p2pTypes';
import {
  MAX_BODY_CHARS,
  MAX_TITLE_CHARS,
  type ForumMessageType,
} from '../../core/protocol';
import { mapRoomError } from '../sessionErrors';
import type { RoomState } from '../roomManagerTypes';
import { appendDmMessage } from './dmTranscript';

type ActionRefs = {
  roomsRef: MutableRefObject<Map<string, RoomState>>;
  activeRoomIdRef: MutableRefObject<string | null>;
  updateRoom: (roomId: string, updater: (prev: RoomState) => RoomState) => void;
};

export async function publishActive(
  refs: ActionRefs,
  input: {
    type: ForumMessageType;
    threadId: string;
    parentMsgId: string | null;
    title: string;
    body: string;
  }
): Promise<boolean> {
  const roomId = refs.activeRoomIdRef.current;
  if (!roomId) return false;
  const room = refs.roomsRef.current.get(roomId);
  if (!room) return false;
  const title = input.title.slice(0, MAX_TITLE_CHARS);
  const body = input.body.slice(0, MAX_BODY_CHARS);
  if (!body.trim()) return false;

  refs.updateRoom(roomId, (r) => ({ ...r, isPublishing: true, roomError: null }));
  try {
    await room.session.publishEvent({
      msgId: crypto.randomUUID(),
      type: input.type,
      threadId: input.threadId,
      parentMsgId: input.parentMsgId,
      title,
      body,
      createdAtMs: Date.now(),
    });
    return true;
  } catch (err) {
    if (err instanceof P2pActionError) {
      const key = mapRoomError(err.code);
      refs.updateRoom(roomId, (r) => ({
        ...r,
        roomError: { key: key === 'errGeneric' ? 'errPublish' : key },
      }));
    } else {
      refs.updateRoom(roomId, (r) => ({ ...r, roomError: { key: 'errPublish' } }));
    }
    return false;
  } finally {
    refs.updateRoom(roomId, (r) => ({ ...r, isPublishing: false }));
  }
}

export async function sendDmActive(
  refs: ActionRefs,
  toUserId: string,
  body: string
): Promise<boolean> {
  const roomId = refs.activeRoomIdRef.current;
  if (!roomId) return false;
  const room = refs.roomsRef.current.get(roomId);
  if (!room) return false;
  try {
    const dm = await room.session.sendDirectMessage(toUserId, body);
    refs.updateRoom(roomId, (r) => {
      const prev = r.dmMessages[toUserId] ?? [];
      const next = appendDmMessage(prev, dm);
      if (!next) return r;
      return {
        ...r,
        dmMessages: { ...r.dmMessages, [toUserId]: next },
      };
    });
    return true;
  } catch {
    refs.updateRoom(roomId, (r) => ({ ...r, roomError: { key: 'errDmSend' } }));
    return false;
  }
}

export function clearForumUnreadAction(refs: ActionRefs, roomId?: string | null) {
  const target = roomId ?? refs.activeRoomIdRef.current;
  if (!target) return;
  refs.updateRoom(target, (r) => (r.unreadCount === 0 ? r : { ...r, unreadCount: 0 }));
}

export function clearDmUnreadAction(refs: ActionRefs, peerId: string) {
  const roomId = refs.activeRoomIdRef.current;
  if (!roomId) return;
  refs.updateRoom(roomId, (r) => ({
    ...r,
    dmUnread: { ...r.dmUnread, [peerId]: 0 },
  }));
}

export function dismissRoomErrorAction(refs: ActionRefs) {
  if (!refs.activeRoomIdRef.current) return;
  refs.updateRoom(refs.activeRoomIdRef.current, (r) => ({ ...r, roomError: null }));
}

export function dismissTransportNoticeAction(refs: ActionRefs) {
  if (!refs.activeRoomIdRef.current) return;
  refs.updateRoom(refs.activeRoomIdRef.current, (r) => ({ ...r, transportNotice: null }));
}

export function dismissKeyChangeAction(refs: ActionRefs, roomId: string, userId: string) {
  refs.updateRoom(roomId, (r) => ({
    ...r,
    keyChangeAlerts: r.keyChangeAlerts.filter((a) => a.userId !== userId),
  }));
}
