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
  /** Join token captured at session open — stale sessions must not write after rejoin. */
  joinToken: number;
  joinTokensRef: MutableRefObject<Map<string, number>>;
  roomsRef: MutableRefObject<Map<string, RoomState>>;
  activeRoomIdRef: MutableRefObject<string | null>;
  forumFocusedRef?: MutableRefObject<boolean>;
  dmsFocusedRef?: MutableRefObject<boolean>;
  activeDmPeerIdRef?: MutableRefObject<string | null>;
  updateRoom: (roomId: string, updater: (prev: RoomState) => RoomState) => void;
  syncRefs: SyncEngineRefs;
};

/** True when this callback bag still owns the live zone session. */
export function isP2pCallbackLive(
  roomsRef: MutableRefObject<Map<string, RoomState>>,
  joinTokensRef: MutableRefObject<Map<string, number>>,
  roomId: string,
  joinToken: number
): boolean {
  return roomsRef.current.has(roomId) && joinTokensRef.current.get(roomId) === joinToken;
}

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
  | 'onRejectedSync'
> {
  const {
    roomId,
    joinToken,
    joinTokensRef,
    roomsRef,
    activeRoomIdRef,
    forumFocusedRef,
    dmsFocusedRef,
    activeDmPeerIdRef,
    updateRoom,
    syncRefs,
  } = ctx;

  const live = () => isP2pCallbackLive(roomsRef, joinTokensRef, roomId, joinToken);

  return {
    onForumMessage: (message) => {
      if (!live()) return;
      updateRoom(roomId, (r) => {
        if (r.messages.some((m) => m.msgId === message.msgId)) return r;
        // Live posts are usually newest — avoid O(n log n) sort on every ingest.
        const prev = r.messages;
        const msgs = prev.slice();
        const last = msgs[msgs.length - 1];
        if (!last || last.createdAtMs <= message.createdAtMs) {
          msgs.push(message);
        } else {
          let lo = 0;
          let hi = msgs.length;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (msgs[mid].createdAtMs <= message.createdAtMs) lo = mid + 1;
            else hi = mid;
          }
          msgs.splice(lo, 0, message);
        }
        const roomIsActive = roomId === activeRoomIdRef.current;
        const forumFocused = forumFocusedRef?.current === true;
        const isSelf = message.authorUserId === r.selfUserId;
        // During post-join sync, still bump for recent live posts (not historical dump).
        const recentLive =
          !r.isSyncing || Date.now() - message.createdAtMs < 90_000;
        const bumpUnread =
          !isSelf &&
          message.type !== 'DELETE_VOTE' &&
          recentLive &&
          !(roomIsActive && forumFocused);
        return {
          ...r,
          messages: msgs,
          unreadCount: bumpUnread ? r.unreadCount + 1 : r.unreadCount,
        };
      });
    },
    onThreadDeleted: (threadId) => {
      if (!live()) return;
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
      if (!live()) return;
      updateRoom(roomId, (r) => {
        if (removed || !state) {
          if (!(userId in r.presence)) return r;
          const next = { ...r.presence };
          delete next[userId];
          return { ...r, presence: next };
        }
        const prev = r.presence[userId];
        // Heartbeats often re-broadcast identical presence — skip Map churn.
        if (
          prev &&
          prev.alias === state.alias &&
          prev.avatarSeed === state.avatarSeed &&
          prev.signPubKeySpkiB64 === state.signPubKeySpkiB64 &&
          prev.encPubKeyRawB64 === state.encPubKeyRawB64
        ) {
          return r;
        }
        return { ...r, presence: { ...r.presence, [userId]: state } };
      });
    },
    onPeerPresence: (ids) => {
      if (!live()) return;
      updateRoom(roomId, (r) => {
        if (sameOnlineIdSet(r.onlineUserIds, ids)) return r;
        return { ...r, onlineUserIds: ids };
      });
    },
    onUserJoined: () => {
      if (!live()) return;
      void runSync(syncRefs, roomId);
    },
    onKeyChange: (userId, level) => {
      if (!live()) return;
      updateRoom(roomId, (r) => {
        if (r.keyChangeAlerts.some((a) => a.userId === userId)) return r;
        return {
          ...r,
          keyChangeAlerts: [...r.keyChangeAlerts, { userId, level }],
        };
      });
    },
    onDirectMessage: (dm) => {
      if (!live()) return;
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
      if (!live()) return;
      void mapRoomErrorAsync(code).then((key) => {
        if (!live()) return;
        updateRoom(roomId, (r) => ({
          ...r,
          roomError: { key, vars: key === 'errGeneric' ? { code } : undefined },
        }));
      });
    },
    onRelayFallback: () => {
      if (!live()) return;
      updateRoom(roomId, (r) => ({
        ...r,
        transportNotice: { key: 'infoRelayPath' },
        relayFallbackActive: true,
      }));
    },
    onRejectedSync: () => {
      if (!live()) return;
      updateRoom(roomId, (r) => ({
        ...r,
        rejectedSyncCount: r.session.getRejectedSyncCount(),
      }));
    },
  };
}
