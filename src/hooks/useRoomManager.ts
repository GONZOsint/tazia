import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { acceptIpConsent, hasIpConsent } from '../core/utils/ipConsent';
import type { SessionError } from './sessionErrors';
import {
  MAX_ROOMS,
  type RoomJoinParams,
  type RoomState,
} from './roomManagerTypes';
import { TOAST } from '../motion/tokens';
import { applyRoomUpdate, roomListChromeEqual } from './roomManager/roomMap';
import {
  clearAllSyncTimers,
  runSync,
  type SyncEngineRefs,
} from './roomManager/syncEngine';
import { bumpJoinToken, joinRoomInternal } from './roomManager/joinRoom';
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
  /** roomsRef is the source of truth; roomsVersion drives React only when UI must see it. */
  const roomsRef = useRef<Map<string, RoomState>>(new Map());
  const [roomsVersion, setRoomsVersion] = useState(0);
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
  const activeRoomIdRef = useRef<string | null>(null);
  const joinTokensRef = useRef<Map<string, number>>(new Map());
  const isJoiningRef = useRef(false);
  const joinGenerationRef = useRef(0);
  const tearingDownRef = useRef(false);
  const leavingRoomIdsRef = useRef<Set<string>>(new Set());
  const forumFocusedRef = options?.forumTabFocusedRef;
  const dmsFocusedRef = options?.dmsTabFocusedRef;
  const activeDmPeerIdRef = options?.activeDmPeerIdRef;
  const onZoneIgnitedRef = useRef(options?.onZoneIgnited);
  onZoneIgnitedRef.current = options?.onZoneIgnited;

  const bumpRoomsUi = useCallback(() => {
    setRoomsVersion((v) => v + 1);
  }, []);

  /** Compatible with join/leave helpers that still call setRooms(...). */
  const setRooms: Dispatch<SetStateAction<Map<string, RoomState>>> = useCallback(
    (action) => {
      const prev = roomsRef.current;
      const next = typeof action === 'function' ? action(prev) : action;
      if (next === prev) return;
      roomsRef.current = next;
      bumpRoomsUi();
    },
    [bumpRoomsUi]
  );

  const setSessionTearingDown = useCallback((tearingDown: boolean) => {
    tearingDownRef.current = tearingDown;
    if (tearingDown) {
      // Invalidate in-flight joins immediately (do not wait for burnSessionAction).
      joinGenerationRef.current += 1;
      if (isJoiningRef.current) {
        for (const id of joinTokensRef.current.keys()) bumpJoinToken(joinTokensRef, id);
        isJoiningRef.current = false;
        setIsJoining(false);
      }
      pendingJoinRef.current = null;
    }
  }, []);

  const updateRoom = useCallback(
    (roomId: string, updater: (prev: RoomState) => RoomState) => {
      const prev = roomsRef.current;
      const next = applyRoomUpdate(prev, roomId, updater);
      if (next === prev) return;
      const before = prev.get(roomId);
      const after = next.get(roomId);
      roomsRef.current = next;

      const isActive = roomId === activeRoomIdRef.current;
      // Background zones: skip React when only forum/DM bodies / presence blobs moved.
      if (
        !isActive &&
        before &&
        after &&
        roomListChromeEqual(before, after)
      ) {
        return;
      }
      bumpRoomsUi();
    },
    [bumpRoomsUi]
  );

  const syncRefs: SyncEngineRefs = {
    roomsRef,
    activeRoomIdRef,
    forumFocusedRef,
    syncTimersRef,
    syncInFlightRef,
    updateRoom,
  };

  // Read ref each render so a tab switch / other state update sees silent background commits.
  // roomsVersion exists only to force re-render when UI must observe room changes.
  void roomsVersion;
  const rooms = roomsRef.current;

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  const dismissBurnNotice = useCallback(() => {
    if (burnTimerRef.current !== null) {
      window.clearTimeout(burnTimerRef.current);
      burnTimerRef.current = null;
    }
    setBurnNotice(false);
  }, []);

  useEffect(() => {
    if (!burnNotice) return;
    // Long backstop so landing users still see it; cleared early on ignite.
    if (burnTimerRef.current !== null) window.clearTimeout(burnTimerRef.current);
    burnTimerRef.current = window.setTimeout(() => setBurnNotice(false), TOAST.warningMs * 3);
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
          tearingDownRef,
          leavingRoomIdsRef,
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
        leavingRoomIdsRef,
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
      leavingRoomIdsRef,
      syncRefs,
      setRooms,
      setActiveRoomId,
      setIsJoining,
    });
  }, []);

  const switchRoom = useCallback(
    (roomId: string) => {
      if (!roomsRef.current.has(roomId)) return;
      // Invalidate any in-flight join so it cannot re-activate a different zone.
      joinGenerationRef.current += 1;
      if (isJoiningRef.current) {
        for (const id of joinTokensRef.current.keys()) bumpJoinToken(joinTokensRef, id);
        isJoiningRef.current = false;
        setIsJoining(false);
      }
      setJoinError(null);
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
    (roomId?: string | null) => dismissRoomErrorAction(actionRefs, roomId),
    [updateRoom]
  );

  const dismissTransportNotice = useCallback(
    (roomId?: string | null) => dismissTransportNoticeAction(actionRefs, roomId),
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
    dismissBurnNotice,
    ipConsentNeeded,
    totalForumUnread,
    totalDmUnread,
    confirmIpConsent,
    cancelIpConsent,
    joinRoom,
    leaveRoom,
    switchRoom,
    burnSession,
    setSessionTearingDown,
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
