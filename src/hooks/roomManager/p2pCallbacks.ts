import type { MutableRefObject } from 'react';
import type { JoinP2pRoomOptions } from '../../core/p2p/p2pTypes';
import { mapRoomErrorAsync } from '../sessionErrors';
import type { RoomState } from '../roomManagerTypes';
import { appendDmMessage } from './dmTranscript';
import { sameOnlineIdSet } from './roomMap';
import type { SyncEngineRefs } from './syncEngine';
import { runSync } from './syncEngine';

export type P2pCallbackContext = {
  roomId: string;
  roomsRef: MutableRefObject<Map<string, RoomState>>;
  activeRoomIdRef: MutableRefObject<string | null>;
  forumFocusedRef?: MutableRefObject<boolean>;
  dmsFocusedRef?: MutableRefObject<boolean>;
  activeDmPeerIdRef?: MutableRefObject<string | null>;
  updateRoom: (roomId: string, updater: (prev: RoomState) => RoomState) => void;
  syncRefs: SyncEngineRefs;
};

/** Build joinP2pRoom callback bag for one room id. */
export function buildP2pCallbacks(ctx: P2pCallbackContext): Pick<
  JoinP2pRoomOptions,
  | 'onForumMessage'
  | 'onThreadDeleted'
  | 'onPresenceChange'
  | 'onPeerPresence'
  | 'onUserJoined'
  | 'onKeyChange'
  | 'onDirectMessage'
  | 'onError'
  | 'onRelayFallback'
> {
  const {
    roomId,
    roomsRef,
    activeRoomIdRef,
    forumFocusedRef,
    dmsFocusedRef,
    activeDmPeerIdRef,
    updateRoom,
    syncRefs,
  } = ctx;

  return {
    onForumMessage: (message) => {
      if (!roomsRef.current.has(roomId)) return;
      updateRoom(roomId, (r) => {
        if (r.messages.some((m) => m.msgId === message.msgId)) return r;
        const msgs = [...r.messages, message].sort((a, b) => a.createdAtMs - b.createdAtMs);
        const roomIsActive = roomId === activeRoomIdRef.current;
        const forumFocused = forumFocusedRef?.current === true;
        const isSelf = message.authorUserId === r.selfUserId;
        const bumpUnread =
          !isSelf &&
          message.type !== 'DELETE_VOTE' &&
          !r.isSyncing &&
          !(roomIsActive && forumFocused);
        return {
          ...r,
          messages: msgs,
          unreadCount: bumpUnread ? r.unreadCount + 1 : r.unreadCount,
        };
      });
    },
    onThreadDeleted: (threadId) => {
      if (!roomsRef.current.has(roomId)) return;
      updateRoom(roomId, (r) => ({
        ...r,
        messages: r.messages.filter(
          (m) =>
            m.threadId !== threadId ||
            m.type === 'DELETE_PROPOSE' ||
            m.type === 'DELETE_VOTE'
        ),
      }));
    },
    onPresenceChange: (userId, state, removed) => {
      if (!roomsRef.current.has(roomId)) return;
      updateRoom(roomId, (r) => {
        const next = { ...r.presence };
        if (removed || !state) delete next[userId];
        else next[userId] = state;
        return { ...r, presence: next };
      });
    },
    onPeerPresence: (ids) => {
      if (!roomsRef.current.has(roomId)) return;
      updateRoom(roomId, (r) => {
        if (sameOnlineIdSet(r.onlineUserIds, ids)) return r;
        return { ...r, onlineUserIds: ids };
      });
    },
    onUserJoined: () => {
      void runSync(syncRefs, roomId);
    },
    onKeyChange: (userId, level) => {
      if (!roomsRef.current.has(roomId)) return;
      updateRoom(roomId, (r) => ({
        ...r,
        keyChangeAlerts: [...r.keyChangeAlerts, { userId, level }],
      }));
    },
    onDirectMessage: (dm) => {
      if (!roomsRef.current.has(roomId)) return;
      const peerId = dm.fromUserId;
      updateRoom(roomId, (r) => {
        const prev = r.dmMessages[peerId] ?? [];
        const next = appendDmMessage(prev, dm);
        if (!next) return r;
        const dmMessages = { ...r.dmMessages, [peerId]: next };
        const viewingPeer =
          roomId === activeRoomIdRef.current &&
          dmsFocusedRef?.current === true &&
          activeDmPeerIdRef?.current === peerId;
        const dmUnread = viewingPeer
          ? r.dmUnread
          : { ...r.dmUnread, [peerId]: (r.dmUnread[peerId] ?? 0) + 1 };
        return { ...r, dmMessages, dmUnread };
      });
    },
    onError: (code) => {
      if (code === 'publish-rate') return;
      if (!roomsRef.current.has(roomId)) return;
      void mapRoomErrorAsync(code).then((key) => {
        updateRoom(roomId, (r) => ({
          ...r,
          roomError: { key, vars: key === 'errGeneric' ? { code } : undefined },
        }));
      });
    },
    onRelayFallback: () => {
      if (!roomsRef.current.has(roomId)) return;
      updateRoom(roomId, (r) => ({
        ...r,
        transportNotice: { key: 'infoRelayPath' },
        relayFallbackActive: true,
      }));
    },
  };
}
