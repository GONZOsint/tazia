import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { buildLocalProfile, type LocalProfile } from '../core/crypto/identity';
import { P2pActionError, type JoinedP2pRoom } from '../core/p2p/p2pTypes';
import {
  MAX_ALIAS_CHARS,
  MAX_BODY_CHARS,
  MAX_TITLE_CHARS,
  type DirectMessage,
  type ForumMessage,
  type ForumMessageType,
  type MeshStatus,
  type PresenceState,
} from '../core/protocol';
import { acceptIpConsent, hasIpConsent } from '../core/utils/ipConsent';
import { mapRoomError, mapRoomErrorAsync, type SessionError } from './sessionErrors';
import type { TrustStore, TrustLevel } from '../core/trust/trustStore';
import { buildRtcConfig } from '../features/rooms/TurnRelaySettings';
import {
  primeLocalNetworkAccess,
  queryLocalNetworkAccess,
} from '../core/p2p/localNetworkAccess';

export type { SessionError } from './sessionErrors';

export interface RoomJoinParams {
  roomId: string;
  secretPhrase: string;
  customAlias?: string;
}

export interface RoomState {
  roomId: string;
  phrase: string;
  profile: LocalProfile;
  selfUserId: string;
  selfSignPubKeyB64: string;
  trustStore: TrustStore;
  session: JoinedP2pRoom;
  messages: ForumMessage[];
  presence: Record<string, PresenceState>;
  onlineUserIds: string[];
  meshStatus: MeshStatus;
  rejectedSyncCount: number;
  isPublishing: boolean;
  isSyncing: boolean;
  roomError: SessionError;
  transportNotice: SessionError;
  keyChangeAlerts: Array<{ userId: string; level: TrustLevel }>;
  unreadCount: number;
  dmMessages: Record<string, DirectMessage[]>;
  dmUnread: Record<string, number>;
}

const MAX_ROOMS = 5;

export function countOtherPeers(
  onlineUserIds: string[],
  selfUserId: string | null | undefined
): number {
  if (!selfUserId) return onlineUserIds.length;
  return onlineUserIds.filter((id) => id !== selfUserId).length;
}

function peerOnlineCount(r: { onlineUserIds: string[]; selfUserId: string }): number {
  return countOtherPeers(r.onlineUserIds, r.selfUserId);
}

function deriveMeshStatus(r: {
  isSyncing: boolean;
  onlineUserIds: string[];
  selfUserId: string;
}): MeshStatus {
  // room.getUsers() includes self — mesh only when another peer is present.
  if (peerOnlineCount(r) > 0) return 'mesh';
  if (r.isSyncing) return 'syncing';
  return 'alone';
}

export function useRoomManager(
  onNavigateTab: (tab: 'forum' | 'rooms' | 'presence') => void,
  options?: {
    forumTabFocusedRef?: MutableRefObject<boolean>;
    dmsTabFocusedRef?: MutableRefObject<boolean>;
    activeDmPeerIdRef?: MutableRefObject<string | null>;
  }
) {
  const [rooms, setRooms] = useState<Map<string, RoomState>>(new Map());
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<SessionError>(null);
  const [burnNotice, setBurnNotice] = useState(false);
  const [ipConsentNeeded, setIpConsentNeeded] = useState(false);
  const pendingJoinRef = useRef<RoomJoinParams | null>(null);
  const burnTimerRef = useRef<number | null>(null);
  const roomsRef = useRef<Map<string, RoomState>>(rooms);
  const activeRoomIdRef = useRef<string | null>(null);
  const joinGenerationRef = useRef(0);
  const forumFocusedRef = options?.forumTabFocusedRef;
  const dmsFocusedRef = options?.dmsTabFocusedRef;
  const activeDmPeerIdRef = options?.activeDmPeerIdRef;

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    return () => {
      if (burnTimerRef.current !== null) window.clearTimeout(burnTimerRef.current);
      for (const room of roomsRef.current.values()) {
        void room.session.leave();
      }
    };
  }, []);

  const updateRoom = useCallback((roomId: string, updater: (prev: RoomState) => RoomState) => {
    setRooms((prev) => {
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
    });
  }, []);

  const joinRoomInternal = useCallback(
    async (params: RoomJoinParams) => {
      const roomIdTrim = params.roomId.trim();
      const phraseTrim = params.secretPhrase.trim();
      if (!roomIdTrim || !phraseTrim) {
        setJoinError({ key: 'errMissingFields' });
        return;
      }

      if (roomsRef.current.has(roomIdTrim)) {
        setActiveRoomId(roomIdTrim);
        onNavigateTab('forum');
        return;
      }

      if (roomsRef.current.size >= MAX_ROOMS) {
        setJoinError({ key: 'errGeneric', vars: { code: 'max-rooms' } });
        return;
      }

      const generation = ++joinGenerationRef.current;
      setIsJoining(true);
      setJoinError(null);

      try {
        const { rtcConfig, turnConfig, relayOnly } = buildRtcConfig();
        const lna = await queryLocalNetworkAccess();
        if (lna !== 'granted') {
          await primeLocalNetworkAccess(lna === 'unsupported' ? 250 : 400);
        }

        const { joinP2pRoom } = await import('../core/p2p/p2pRoom');
        if (joinGenerationRef.current !== generation) return;

        const session = await joinP2pRoom({
          roomId: roomIdTrim,
          password: phraseTrim,
          rtcConfig,
          turnConfig,
          relayOnly,
          onForumMessage: (message) => {
            if (joinGenerationRef.current !== generation) return;
            updateRoom(roomIdTrim, (r) => {
              if (r.messages.some((m) => m.msgId === message.msgId)) return r;
              const msgs = [...r.messages, message].sort((a, b) => a.createdAtMs - b.createdAtMs);
              const roomIsActive = roomIdTrim === activeRoomIdRef.current;
              const forumFocused = forumFocusedRef?.current === true;
              const isSelf = message.authorUserId === r.selfUserId;
              const bumpUnread =
                !isSelf && !r.isSyncing && !(roomIsActive && forumFocused);
              return {
                ...r,
                messages: msgs,
                unreadCount: bumpUnread ? r.unreadCount + 1 : r.unreadCount,
              };
            });
          },
          onPresenceChange: (userId, state, removed) => {
            updateRoom(roomIdTrim, (r) => {
              const next = { ...r.presence };
              if (removed || !state) delete next[userId];
              else next[userId] = state;
              return { ...r, presence: next };
            });
          },
          onPeerPresence: (ids) => {
            updateRoom(roomIdTrim, (r) => ({ ...r, onlineUserIds: ids }));
          },
          onUserJoined: () => {
            const room = roomsRef.current.get(roomIdTrim);
            if (room) {
              void room.session.requestSyncFromPeers().then(() => {
                updateRoom(roomIdTrim, (r) => ({
                  ...r,
                  rejectedSyncCount: r.session.getRejectedSyncCount(),
                }));
              });
            }
          },
          onKeyChange: (userId, level) => {
            updateRoom(roomIdTrim, (r) => ({
              ...r,
              keyChangeAlerts: [...r.keyChangeAlerts, { userId, level }],
            }));
          },
          onDirectMessage: (dm) => {
            const peerId = dm.fromUserId;
            updateRoom(roomIdTrim, (r) => {
              const prev = r.dmMessages[peerId] ?? [];
              if (prev.some((m) => m.msgId === dm.msgId)) return r;
              const dmMessages = { ...r.dmMessages, [peerId]: [...prev, dm] };
              const viewingPeer =
                roomIdTrim === activeRoomIdRef.current &&
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
            void mapRoomErrorAsync(code).then((key) => {
              updateRoom(roomIdTrim, (r) => ({
                ...r,
                roomError: { key, vars: key === 'errGeneric' ? { code } : undefined },
              }));
            });
          },
          onRelayFallback: () => {
            updateRoom(roomIdTrim, (r) => ({
              ...r,
              transportNotice: { key: 'infoRelayPath' },
            }));
          },
        });

        if (joinGenerationRef.current !== generation) {
          await session.leave();
          return;
        }

        const localProfile = await buildLocalProfile(
          session.selfUserId,
          params.customAlias?.trim().slice(0, MAX_ALIAS_CHARS)
        );
        await session.setPresenceAlias(localProfile.alias);

        if (joinGenerationRef.current !== generation) {
          await session.leave();
          return;
        }

        const roomState: RoomState = {
          roomId: roomIdTrim,
          phrase: phraseTrim,
          profile: localProfile,
          selfUserId: session.selfUserId,
          selfSignPubKeyB64: session.signPubKeySpkiB64,
          trustStore: session.trustStore,
          session,
          messages: [],
          presence: session.getPresenceMap(),
          onlineUserIds: session.getOnlineUserIds(),
          meshStatus: deriveMeshStatus({
            isSyncing: true,
            onlineUserIds: session.getOnlineUserIds(),
            selfUserId: session.selfUserId,
          }),
          rejectedSyncCount: 0,
          isPublishing: false,
          isSyncing: true,
          roomError: null,
          transportNotice: null,
          keyChangeAlerts: [],
          unreadCount: 0,
          dmMessages: {},
          dmUnread: {},
        };

        setRooms((prev) => {
          const next = new Map(prev);
          next.set(roomIdTrim, roomState);
          return next;
        });
        setActiveRoomId(roomIdTrim);
        onNavigateTab('forum');

        for (const delayMs of [800, 2500, 6000]) {
          window.setTimeout(async () => {
            if (joinGenerationRef.current !== generation) return;
            const room = roomsRef.current.get(roomIdTrim);
            if (!room) return;
            updateRoom(roomIdTrim, (r) => ({ ...r, isSyncing: true }));
            try {
              await room.session.requestSyncFromPeers();
              updateRoom(roomIdTrim, (r) => ({
                ...r,
                isSyncing: false,
                rejectedSyncCount: r.session.getRejectedSyncCount(),
                unreadCount:
                  forumFocusedRef?.current === true && roomIdTrim === activeRoomIdRef.current
                    ? 0
                    : r.unreadCount,
              }));
            } catch {
              updateRoom(roomIdTrim, (r) => ({ ...r, isSyncing: false }));
            }
          }, delayMs);
        }
      } catch (err) {
        if (joinGenerationRef.current !== generation) return;
        if (err instanceof P2pActionError) {
          const key = mapRoomError(err.code);
          setJoinError(key === 'errGeneric' ? { key: 'errJoinFailed' } : { key });
        } else {
          setJoinError({ key: 'errJoinFailed' });
        }
      } finally {
        if (joinGenerationRef.current === generation) setIsJoining(false);
      }
    },
    [forumFocusedRef, onNavigateTab, updateRoom]
  );

  const joinRoom = useCallback(
    async (params: RoomJoinParams) => {
      if (!hasIpConsent()) {
        pendingJoinRef.current = params;
        setIpConsentNeeded(true);
        return;
      }
      await joinRoomInternal(params);
    },
    [joinRoomInternal]
  );

  const confirmIpConsent = useCallback(async () => {
    acceptIpConsent();
    setIpConsentNeeded(false);
    const pending = pendingJoinRef.current;
    pendingJoinRef.current = null;
    if (pending) await joinRoomInternal(pending);
  }, [joinRoomInternal]);

  const cancelIpConsent = useCallback(() => {
    setIpConsentNeeded(false);
    pendingJoinRef.current = null;
  }, []);

  const leaveRoom = useCallback(async (roomId: string) => {
    const room = roomsRef.current.get(roomId);
    if (!room) return;
    try {
      await room.session.leave();
    } catch {
      /* ignore */
    }
    setRooms((prev) => {
      const next = new Map(prev);
      next.delete(roomId);
      roomsRef.current = next;
      setActiveRoomId((cur) => {
        if (cur !== roomId) return cur;
        return [...next.keys()][0] ?? null;
      });
      return next;
    });
  }, []);

  const burnSession = useCallback(async () => {
    joinGenerationRef.current += 1;
    pendingJoinRef.current = null;
    setIpConsentNeeded(false);
    setIsJoining(false);
    for (const room of roomsRef.current.values()) {
      try {
        await room.session.leave();
      } catch {
        /* ignore */
      }
    }
    setRooms(new Map());
    setActiveRoomId(null);
    setJoinError(null);
    setBurnNotice(true);
    onNavigateTab('rooms');
    if (burnTimerRef.current !== null) window.clearTimeout(burnTimerRef.current);
    burnTimerRef.current = window.setTimeout(() => setBurnNotice(false), 4000);
  }, [onNavigateTab]);

  const switchRoom = useCallback(
    (roomId: string) => {
      if (!roomsRef.current.has(roomId)) return;
      setActiveRoomId(roomId);
      updateRoom(roomId, (r) => ({ ...r, unreadCount: 0 }));
      onNavigateTab('forum');
    },
    [onNavigateTab, updateRoom]
  );

  const clearForumUnread = useCallback(
    (roomId?: string | null) => {
      const target = roomId ?? activeRoomIdRef.current;
      if (!target) return;
      updateRoom(target, (r) =>
        r.unreadCount === 0 ? r : { ...r, unreadCount: 0 }
      );
    },
    [updateRoom]
  );

  const dismissRoomError = useCallback(() => {
    if (!activeRoomIdRef.current) return;
    updateRoom(activeRoomIdRef.current, (r) => ({ ...r, roomError: null }));
  }, [updateRoom]);

  const dismissTransportNotice = useCallback(() => {
    if (!activeRoomIdRef.current) return;
    updateRoom(activeRoomIdRef.current, (r) => ({ ...r, transportNotice: null }));
  }, [updateRoom]);

  const publish = useCallback(
    async (input: {
      type: ForumMessageType;
      threadId: string;
      parentMsgId: string | null;
      title: string;
      body: string;
    }): Promise<boolean> => {
      if (!activeRoomId) return false;
      const room = roomsRef.current.get(activeRoomId);
      if (!room) return false;
      const title = input.title.slice(0, MAX_TITLE_CHARS);
      const body = input.body.slice(0, MAX_BODY_CHARS);
      if (!body.trim()) return false;

      updateRoom(activeRoomId, (r) => ({ ...r, isPublishing: true, roomError: null }));
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
          updateRoom(activeRoomId, (r) => ({
            ...r,
            roomError: { key: key === 'errGeneric' ? 'errPublish' : key },
          }));
        } else {
          updateRoom(activeRoomId, (r) => ({ ...r, roomError: { key: 'errPublish' } }));
        }
        return false;
      } finally {
        updateRoom(activeRoomId, (r) => ({ ...r, isPublishing: false }));
      }
    },
    [activeRoomId, updateRoom]
  );

  const syncNow = useCallback(async () => {
    if (!activeRoomId) return;
    const room = roomsRef.current.get(activeRoomId);
    if (!room) return;
    updateRoom(activeRoomId, (r) => ({ ...r, isSyncing: true }));
    try {
      await room.session.requestSyncFromPeers();
      updateRoom(activeRoomId, (r) => ({
        ...r,
        isSyncing: false,
        rejectedSyncCount: r.session.getRejectedSyncCount(),
      }));
    } catch {
      updateRoom(activeRoomId, (r) => ({ ...r, isSyncing: false, roomError: { key: 'errSync' } }));
    }
  }, [activeRoomId, updateRoom]);

  const dismissKeyChange = useCallback(
    (roomId: string, userId: string) => {
      updateRoom(roomId, (r) => ({
        ...r,
        keyChangeAlerts: r.keyChangeAlerts.filter((a) => a.userId !== userId),
      }));
    },
    [updateRoom]
  );

  const active = activeRoomId ? (rooms.get(activeRoomId) ?? null) : null;

  const presenceAliases = useMemo(() => {
    if (!active) return {};
    const map: Record<string, string> = {};
    for (const [id, state] of Object.entries(active.presence)) {
      if (state.alias) map[id] = state.alias;
    }
    return map;
  }, [active]);

  const totalForumUnread = useMemo(() => {
    let n = 0;
    for (const r of rooms.values()) n += r.unreadCount;
    return n;
  }, [rooms]);

  const totalDmUnread = useMemo(() => {
    if (!active) return 0;
    return Object.values(active.dmUnread).reduce((a, b) => a + b, 0);
  }, [active]);

  const sendDm = useCallback(
    async (toUserId: string, body: string): Promise<boolean> => {
      if (!activeRoomId) return false;
      const room = roomsRef.current.get(activeRoomId);
      if (!room) return false;
      try {
        const dm = await room.session.sendDirectMessage(toUserId, body);
        updateRoom(activeRoomId, (r) => {
          const prev = r.dmMessages[toUserId] ?? [];
          return {
            ...r,
            dmMessages: { ...r.dmMessages, [toUserId]: [...prev, dm] },
          };
        });
        return true;
      } catch {
        updateRoom(activeRoomId, (r) => ({ ...r, roomError: { key: 'errPublish' } }));
        return false;
      }
    },
    [activeRoomId, updateRoom]
  );

  const clearDmUnread = useCallback(
    (peerId: string) => {
      if (!activeRoomId) return;
      updateRoom(activeRoomId, (r) => ({
        ...r,
        dmUnread: { ...r.dmUnread, [peerId]: 0 },
      }));
    },
    [activeRoomId, updateRoom]
  );

  return {
    rooms,
    activeRoomId,
    activeRoom: active,
    presenceAliases,
    isJoining,
    joinError,
    burnNotice,
    ipConsentNeeded,
    totalForumUnread,
    totalDmUnread,
    confirmIpConsent,
    cancelIpConsent,
    joinRoom,
    leaveRoom,
    switchRoom,
    burnSession,
    publish,
    syncNow,
    sendDm,
    clearDmUnread,
    clearForumUnread,
    dismissRoomError,
    dismissTransportNotice,
    dismissKeyChange,
  };
}
