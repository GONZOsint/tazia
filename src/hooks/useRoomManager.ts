import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { buildLocalProfile } from '../core/crypto/identity';
import { evaluatePassphraseStrength } from '../core/crypto/passphraseWords';
import { P2pActionError } from '../core/p2p/p2pTypes';
import {
  MAX_ALIAS_CHARS,
  MAX_BODY_CHARS,
  MAX_TITLE_CHARS,
  type ForumMessageType,
} from '../core/protocol';
import { acceptIpConsent, hasIpConsent } from '../core/utils/ipConsent';
import { mapRoomError, mapRoomErrorAsync, type SessionError } from './sessionErrors';
import { buildRtcConfig } from '../features/rooms/TurnRelaySettings';
import {
  primeLocalNetworkAccess,
  queryLocalNetworkAccess,
} from '../core/p2p/localNetworkAccess';
import {
  MAX_ROOMS,
  deriveMeshStatus,
  type RoomJoinParams,
  type RoomState,
} from './roomManagerTypes';

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
  /** Per-room join sync retry timers — cleared on leave/burn. */
  const syncTimersRef = useRef<Map<string, number[]>>(new Map());
  const syncInFlightRef = useRef<Set<string>>(new Set());
  const roomsRef = useRef<Map<string, RoomState>>(rooms);
  const activeRoomIdRef = useRef<string | null>(null);
  /** Per-room join tokens — only invalidate same-id rejoin / burn / unmount. */
  const joinTokensRef = useRef<Map<string, number>>(new Map());
  const isJoiningRef = useRef(false);
  const forumFocusedRef = options?.forumTabFocusedRef;
  const dmsFocusedRef = options?.dmsTabFocusedRef;
  const activeDmPeerIdRef = options?.activeDmPeerIdRef;
  const onZoneIgnitedRef = useRef(options?.onZoneIgnited);
  onZoneIgnitedRef.current = options?.onZoneIgnited;

  const bumpJoinToken = (roomId: string) => {
    const next = (joinTokensRef.current.get(roomId) ?? 0) + 1;
    joinTokensRef.current.set(roomId, next);
    return next;
  };

  const isJoinTokenCurrent = (roomId: string, token: number) =>
    joinTokensRef.current.get(roomId) === token;

  const clearSyncTimers = (roomId: string) => {
    const timers = syncTimersRef.current.get(roomId);
    if (!timers) return;
    for (const id of timers) window.clearTimeout(id);
    syncTimersRef.current.delete(roomId);
    syncInFlightRef.current.delete(roomId);
  };

  const runSync = async (roomId: string) => {
    const room = roomsRef.current.get(roomId);
    if (!room || syncInFlightRef.current.has(roomId)) return;
    syncInFlightRef.current.add(roomId);
    updateRoom(roomId, (r) => ({ ...r, isSyncing: true }));
    try {
      await room.session.requestSyncFromPeers();
      updateRoom(roomId, (r) => ({
        ...r,
        isSyncing: false,
        rejectedSyncCount: r.session.getRejectedSyncCount(),
        unreadCount:
          forumFocusedRef?.current === true && roomId === activeRoomIdRef.current
            ? 0
            : r.unreadCount,
      }));
    } catch {
      updateRoom(roomId, (r) => ({ ...r, isSyncing: false }));
    } finally {
      syncInFlightRef.current.delete(roomId);
    }
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
    burnTimerRef.current = window.setTimeout(() => setBurnNotice(false), 4000);
    return () => {
      if (burnTimerRef.current !== null) window.clearTimeout(burnTimerRef.current);
    };
  }, [burnNotice]);

  useEffect(() => {
    return () => {
      if (burnTimerRef.current !== null) window.clearTimeout(burnTimerRef.current);
      for (const room of roomsRef.current.values()) {
        void room.session.leave();
      }
    };
  }, []);

  // After background/offline, re-arm Nostr fallback + presence (Trystero has no restartIce).
  useEffect(() => {
    let debounce: number | null = null;
    const kick = () => {
      if (debounce !== null) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        debounce = null;
        for (const room of roomsRef.current.values()) {
          void room.session.nudgeTransport().then(() => room.session.requestSyncFromPeers()).catch(() => {
            /* ignore */
          });
        }
      }, 900);
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') kick();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', kick);
    return () => {
      if (debounce !== null) window.clearTimeout(debounce);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', kick);
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

      if (!evaluatePassphraseStrength(phraseTrim).isAcceptable) {
        setJoinError({ key: 'errWeakPhrase' });
        return;
      }

      const existing = roomsRef.current.get(roomIdTrim);
      if (existing) {
        if (existing.phrase !== phraseTrim) {
          setJoinError({ key: 'errPhraseMismatch' });
          return;
        }
        setActiveRoomId(roomIdTrim);
        onNavigateTab('forum');
        return;
      }

      if (roomsRef.current.size >= MAX_ROOMS) {
        setJoinError({ key: 'errMaxRooms', vars: { n: MAX_ROOMS } });
        return;
      }

      if (isJoiningRef.current) {
        setJoinError({ key: 'errJoinBusy' });
        return;
      }

      const token = bumpJoinToken(roomIdTrim);
      isJoiningRef.current = true;
      setIsJoining(true);
      setJoinError(null);

      try {
        const { rtcConfig, turnConfig, relayOnly } = buildRtcConfig();
        const lna = await queryLocalNetworkAccess();
        if (lna !== 'granted') {
          await primeLocalNetworkAccess(lna === 'unsupported' ? 250 : 400);
        }

        const { joinP2pRoom } = await import('../core/p2p/p2pRoom');
        if (!isJoinTokenCurrent(roomIdTrim, token)) return;

        const session = await joinP2pRoom({
          roomId: roomIdTrim,
          password: phraseTrim,
          rtcConfig,
          turnConfig,
          relayOnly,
          onForumMessage: (message) => {
            if (!roomsRef.current.has(roomIdTrim)) return;
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
            if (!roomsRef.current.has(roomIdTrim)) return;
            updateRoom(roomIdTrim, (r) => {
              const next = { ...r.presence };
              if (removed || !state) delete next[userId];
              else next[userId] = state;
              return { ...r, presence: next };
            });
          },
          onPeerPresence: (ids) => {
            if (!roomsRef.current.has(roomIdTrim)) return;
            updateRoom(roomIdTrim, (r) => ({ ...r, onlineUserIds: ids }));
          },
          onUserJoined: () => {
            void runSync(roomIdTrim);
          },
          onKeyChange: (userId, level) => {
            if (!roomsRef.current.has(roomIdTrim)) return;
            updateRoom(roomIdTrim, (r) => ({
              ...r,
              keyChangeAlerts: [...r.keyChangeAlerts, { userId, level }],
            }));
          },
          onDirectMessage: (dm) => {
            if (!roomsRef.current.has(roomIdTrim)) return;
            const peerId = dm.fromUserId;
            updateRoom(roomIdTrim, (r) => {
              const prev = r.dmMessages[peerId] ?? [];
              if (prev.some((m) => m.msgId === dm.msgId)) return r;
              const next = [...prev, dm].sort(
                (a, b) => a.createdAtMs - b.createdAtMs || a.msgId.localeCompare(b.msgId)
              );
              const dmMessages = { ...r.dmMessages, [peerId]: next };
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
            if (!roomsRef.current.has(roomIdTrim)) return;
            void mapRoomErrorAsync(code).then((key) => {
              updateRoom(roomIdTrim, (r) => ({
                ...r,
                roomError: { key, vars: key === 'errGeneric' ? { code } : undefined },
              }));
            });
          },
          onRelayFallback: () => {
            if (!roomsRef.current.has(roomIdTrim)) return;
            updateRoom(roomIdTrim, (r) => ({
              ...r,
              transportNotice: { key: 'infoRelayPath' },
              relayFallbackActive: true,
            }));
          },
        });

        if (!isJoinTokenCurrent(roomIdTrim, token)) {
          await session.leave();
          return;
        }

        const localProfile = await buildLocalProfile(
          session.selfUserId,
          params.customAlias?.trim().slice(0, MAX_ALIAS_CHARS)
        );
        await session.setPresenceAlias(localProfile.alias);

        if (!isJoinTokenCurrent(roomIdTrim, token)) {
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
          relayFallbackActive: false,
          keyChangeAlerts: [],
          unreadCount: 0,
          dmMessages: {},
          dmUnread: {},
        };

        // First zone → Plaza; additional zones stay on Zonas so the hub updates in view.
        const isAdditionalZone = roomsRef.current.size > 0;

        setRooms((prev) => {
          const next = new Map(prev);
          next.set(roomIdTrim, roomState);
          roomsRef.current = next;
          return next;
        });
        setActiveRoomId(roomIdTrim);
        onNavigateTab(isAdditionalZone ? 'rooms' : 'forum');
        onZoneIgnitedRef.current?.(roomIdTrim, { firstZone: !isAdditionalZone });

        const timers: number[] = [];
        for (const delayMs of [800, 2500, 6000]) {
          timers.push(
            window.setTimeout(() => {
              void runSync(roomIdTrim);
            }, delayMs)
          );
        }
        syncTimersRef.current.set(roomIdTrim, timers);
      } catch (err) {
        if (!isJoinTokenCurrent(roomIdTrim, token)) return;
        if (err instanceof P2pActionError) {
          const key = mapRoomError(err.code);
          setJoinError(key === 'errGeneric' ? { key: 'errJoinFailed' } : { key });
        } else {
          setJoinError({ key: 'errJoinFailed' });
        }
      } finally {
        if (isJoinTokenCurrent(roomIdTrim, token)) {
          isJoiningRef.current = false;
          setIsJoining(false);
        }
      }
    },
    [forumFocusedRef, onNavigateTab, updateRoom, dmsFocusedRef, activeDmPeerIdRef]
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
    bumpJoinToken(roomId);
    clearSyncTimers(roomId);
    try {
      await room.session.leave();
    } catch {
      /* ignore */
    }
    const next = new Map(roomsRef.current);
    next.delete(roomId);
    roomsRef.current = next;
    setRooms(next);
    setActiveRoomId((cur) => {
      if (cur !== roomId) return cur;
      return [...next.keys()][0] ?? null;
    });
  }, []);

  const burnSession = useCallback(async () => {
    for (const id of joinTokensRef.current.keys()) bumpJoinToken(id);
    for (const id of [...syncTimersRef.current.keys()]) clearSyncTimers(id);
    joinTokensRef.current.clear();
    pendingJoinRef.current = null;
    isJoiningRef.current = false;
    // Tear down meshes via refs only — React setState before reload remounts
    // empty chrome under the burn veil and causes a visible flicker.
    for (const room of roomsRef.current.values()) {
      try {
        await room.session.leave();
      } catch {
        /* ignore */
      }
    }
    roomsRef.current = new Map();
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    try {
      // Set after clear so the post-reload notice banner can animate once.
      sessionStorage.setItem('tazia-burn-notice', '1');
    } catch {
      /* ignore */
    }
    // Hard reload after tear-down so no room secrets linger in JS heap / UI state.
    window.location.reload();
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
      const roomId = activeRoomIdRef.current;
      if (!roomId) return false;
      const room = roomsRef.current.get(roomId);
      if (!room) return false;
      const title = input.title.slice(0, MAX_TITLE_CHARS);
      const body = input.body.slice(0, MAX_BODY_CHARS);
      if (!body.trim()) return false;

      updateRoom(roomId, (r) => ({ ...r, isPublishing: true, roomError: null }));
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
          updateRoom(roomId, (r) => ({
            ...r,
            roomError: { key: key === 'errGeneric' ? 'errPublish' : key },
          }));
        } else {
          updateRoom(roomId, (r) => ({ ...r, roomError: { key: 'errPublish' } }));
        }
        return false;
      } finally {
        updateRoom(roomId, (r) => ({ ...r, isPublishing: false }));
      }
    },
    [updateRoom]
  );

  const syncNow = useCallback(async () => {
    const roomId = activeRoomIdRef.current;
    if (!roomId) return;
    await runSync(roomId);
  }, []);

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
    let n = 0;
    for (const r of rooms.values()) {
      for (const c of Object.values(r.dmUnread)) n += c;
    }
    return n;
  }, [rooms]);

  const sendDm = useCallback(
    async (toUserId: string, body: string): Promise<boolean> => {
      const roomId = activeRoomIdRef.current;
      if (!roomId) return false;
      const room = roomsRef.current.get(roomId);
      if (!room) return false;
      try {
        const dm = await room.session.sendDirectMessage(toUserId, body);
        updateRoom(roomId, (r) => {
          const prev = r.dmMessages[toUserId] ?? [];
          if (prev.some((m) => m.msgId === dm.msgId)) return r;
          const next = [...prev, dm].sort(
            (a, b) => a.createdAtMs - b.createdAtMs || a.msgId.localeCompare(b.msgId)
          );
          return {
            ...r,
            dmMessages: { ...r.dmMessages, [toUserId]: next },
          };
        });
        return true;
      } catch {
        updateRoom(roomId, (r) => ({ ...r, roomError: { key: 'errDmSend' } }));
        return false;
      }
    },
    [updateRoom]
  );

  const clearDmUnread = useCallback(
    (peerId: string) => {
      const roomId = activeRoomIdRef.current;
      if (!roomId) return;
      updateRoom(roomId, (r) => ({
        ...r,
        dmUnread: { ...r.dmUnread, [peerId]: 0 },
      }));
    },
    [updateRoom]
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
