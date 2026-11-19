import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { acceptIpConsent, hasIpConsent } from '../core/utils/ipConsent';
import type { SessionError } from './sessionErrors';
import {
  MAX_ROOMS,
  type RoomJoinParams,
  type RoomState,
} from './roomManagerTypes';
import { TOAST } from '../motion/tokens';
import { applyRoomUpdate } from './roomManager/roomMap';
import {
  clearAllSyncTimers,
  runSync,
  type SyncEngineRefs,
} from './roomManager/syncEngine';
import { joinRoomInternal } from './roomManager/joinRoom';
import {
  attachVisibilitySync,
  burnSessionAction,
  leaveRoomAction,
} from './roomManager/lifecycle';
import {
  clearDmUnreadAction,
  clearForumUnreadAction,
  dismissKeyChangeAction,
  dismissRoomErrorAction,
  dismissTransportNoticeAction,
  publishActive,
  sendDmActive,
} from './roomManager/sessionActions';

export type { SessionError } from './sessionErrors';
export type { RoomJoinParams, RoomState } from './roomManagerTypes';
export { MAX_ROOMS, countOtherPeers } from './roomManagerTypes';

export function useRoomManager(
  onNavigateTab: (tab: 'forum' | 'rooms' | 'presence') => void,
  options?: {
    forumTabFocusedRef?: MutableRefObject<boolean>;
    dmsTabFocusedRef?: MutableRefObject<boolean>;
    activeDmPeerIdRef?: MutableRefObject<string | null>;
    /** Fired once after a new zone successfully joins the map. */
    onZoneIgnited?: (roomId: string, meta: { firstZone: boolean }) => void;
  }
) {
  const [rooms, setRooms] = useState<Map<string, RoomState>>(new Map());
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<SessionError>(null);
  const [burnNotice, setBurnNotice] = useState(() => {
    try {
      if (sessionStorage.getItem('tazia-burn-notice') === '1') {
        sessionStorage.removeItem('tazia-burn-notice');
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  });
  const [ipConsentNeeded, setIpConsentNeeded] = useState(false);
  const pendingJoinRef = useRef<RoomJoinParams | null>(null);
  const burnTimerRef = useRef<number | null>(null);
  const syncTimersRef = useRef<Map<string, number[]>>(new Map());
  const syncInFlightRef = useRef<Set<string>>(new Set());
  const roomsRef = useRef<Map<string, RoomState>>(rooms);
  const activeRoomIdRef = useRef<string | null>(null);
  const joinTokensRef = useRef<Map<string, number>>(new Map());
  const isJoiningRef = useRef(false);
  const joinGenerationRef = useRef(0);
  const forumFocusedRef = options?.forumTabFocusedRef;
  const dmsFocusedRef = options?.dmsTabFocusedRef;
  const activeDmPeerIdRef = options?.activeDmPeerIdRef;
  const onZoneIgnitedRef = useRef(options?.onZoneIgnited);
  onZoneIgnitedRef.current = options?.onZoneIgnited;

  const updateRoom = useCallback((roomId: string, updater: (prev: RoomState) => RoomState) => {
    setRooms((prev) => applyRoomUpdate(prev, roomId, updater));
  }, []);

  const syncRefs: SyncEngineRefs = {
    roomsRef,
    activeRoomIdRef,
    forumFocusedRef,
    syncTimersRef,
    syncInFlightRef,
    updateRoom,
  };

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    if (!burnNotice) return;
    if (burnTimerRef.current !== null) window.clearTimeout(burnTimerRef.current);
    burnTimerRef.current = window.setTimeout(() => setBurnNotice(false), TOAST.warningMs);
    return () => {
      if (burnTimerRef.current !== null) window.clearTimeout(burnTimerRef.current);
    };
  }, [burnNotice]);

  useEffect(() => {
    return () => {
      if (burnTimerRef.current !== null) window.clearTimeout(burnTimerRef.current);
      clearAllSyncTimers(syncRefs);
      for (const room of roomsRef.current.values()) {
        void room.session.leave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only teardown
  }, []);

  useEffect(() => attachVisibilitySync(roomsRef), []);

  const joinRoomInternalBound = useCallback(
    (params: RoomJoinParams) =>
      joinRoomInternal(
        {
          roomsRef,
          activeRoomIdRef,
          joinTokensRef,
          isJoiningRef,
          joinGenerationRef,
          forumFocusedRef,
          dmsFocusedRef,
          activeDmPeerIdRef,
          onZoneIgnitedRef,
          syncRefs,
          updateRoom,
          setRooms,
          setActiveRoomId,
          setIsJoining,
          setJoinError,
          onNavigateTab,
        },
        params
      ),
    [forumFocusedRef, onNavigateTab, updateRoom, dmsFocusedRef, activeDmPeerIdRef]
  );

  const joinRoom = useCallback(
    async (params: RoomJoinParams) => {
      if (!hasIpConsent()) {
        pendingJoinRef.current = params;
        setIpConsentNeeded(true);
        return;
      }
      await joinRoomInternalBound(params);
    },
    [joinRoomInternalBound]
  );

  const confirmIpConsent = useCallback(async () => {
    acceptIpConsent();
    setIpConsentNeeded(false);
    const pending = pendingJoinRef.current;
    pendingJoinRef.current = null;
    if (pending) await joinRoomInternalBound(pending);
  }, [joinRoomInternalBound]);

  const cancelIpConsent = useCallback(() => {
    setIpConsentNeeded(false);
    pendingJoinRef.current = null;
  }, []);

  const leaveRoom = useCallback(
    async (roomId: string) => {
      await leaveRoomAction({
        roomId,
        roomsRef,
        joinTokensRef,
        syncRefs,
        setRooms,
        setActiveRoomId,
      });
    },
    []
  );

  const burnSession = useCallback(async () => {
    await burnSessionAction({
      roomsRef,
      joinTokensRef,
      joinGenerationRef,
      isJoiningRef,
      pendingJoinRef,
      syncRefs,
      setRooms,
      setActiveRoomId,
      setIsJoining,
    });
  }, []);

  const switchRoom = useCallback(
    (roomId: string) => {
      if (!roomsRef.current.has(roomId)) return;
      setActiveRoomId(roomId);
      updateRoom(roomId, (r) => ({ ...r, unreadCount: 0 }));
      onNavigateTab('forum');
    },
    [onNavigateTab, updateRoom]
  );

  const actionRefs = { roomsRef, activeRoomIdRef, updateRoom };

  const clearForumUnread = useCallback(
    (roomId?: string | null) => clearForumUnreadAction(actionRefs, roomId),
    [updateRoom]
  );

  const dismissRoomError = useCallback(
    () => dismissRoomErrorAction(actionRefs),
    [updateRoom]
  );

  const dismissTransportNotice = useCallback(
    () => dismissTransportNoticeAction(actionRefs),
    [updateRoom]
  );

  const publish = useCallback(
    (input: {
      type: import('../core/protocol').ForumMessageType;
      threadId: string;
      parentMsgId: string | null;
      title: string;
      body: string;
    }) => publishActive(actionRefs, input),
    [updateRoom]
  );

  const syncNow = useCallback(async () => {
    const roomId = activeRoomIdRef.current;
    if (!roomId) return;
    await runSync(syncRefs, roomId);
  }, [updateRoom]);

  const dismissKeyChange = useCallback(
    (roomId: string, userId: string) => dismissKeyChangeAction(actionRefs, roomId, userId),
    [updateRoom]
  );

  const sendDm = useCallback(
    (toUserId: string, body: string) => sendDmActive(actionRefs, toUserId, body),
    [updateRoom]
  );

  const clearDmUnread = useCallback(
    (peerId: string) => clearDmUnreadAction(actionRefs, peerId),
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

  const presenceAvatarSeeds = useMemo(() => {
    if (!active) return {};
    const map: Record<string, string> = {};
    for (const [id, state] of Object.entries(active.presence)) {
      if (state.avatarSeed) map[id] = state.avatarSeed;
    }
    if (active.profile.avatarSeed) {
      map[active.selfUserId] = active.profile.avatarSeed;
    }
    return map;
  }, [active]);

  const totalForumUnread = useMemo(() => {
    let n = 0;
    for (const r of rooms.values()) n += r.unreadCount;
    return n;
  }, [rooms]);

  const totalDmUnread = useMemo(() => {
    let n = 0;
    for (const r of rooms.values()) {
      for (const c of Object.values(r.dmUnread)) n += c;
    }
    return n;
  }, [rooms]);

  return {
    rooms,
    activeRoomId,
    activeRoom: active,
    presenceAliases,
    presenceAvatarSeeds,
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
