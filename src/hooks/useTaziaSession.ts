import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildLocalProfile, type LocalProfile } from '../core/crypto/identity';
import {
  joinP2pRoom,
  P2pActionError,
  type JoinedP2pRoom,
} from '../core/p2p/p2pRoom';
import {
  MAX_ALIAS_CHARS,
  MAX_BODY_CHARS,
  MAX_TITLE_CHARS,
  type ForumMessage,
  type ForumMessageType,
  type MeshStatus,
  type PresenceState,
} from '../core/protocol';
import { acceptIpConsent, hasIpConsent } from '../core/utils/ipConsent';
import { mapRoomError, type SessionError } from './sessionErrors';

export type { SessionError } from './sessionErrors';

export interface RoomJoinParams {
  roomId: string;
  secretPhrase: string;
  customAlias?: string;
}

export function useTaziaSession(onNavigateTab: (tab: 'forum' | 'rooms' | 'presence') => void) {
  const [joined, setJoined] = useState<JoinedP2pRoom | null>(null);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [phrase, setPhrase] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<SessionError>(null);
  const [roomError, setRoomError] = useState<SessionError>(null);
  const [burnNotice, setBurnNotice] = useState(false);
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [presence, setPresence] = useState<Record<string, PresenceState>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [rejectedSyncCount, setRejectedSyncCount] = useState(0);
  const [ipConsentNeeded, setIpConsentNeeded] = useState(false);
  const pendingJoinRef = useRef<RoomJoinParams | null>(null);

  const joinedRef = useRef<JoinedP2pRoom | null>(null);
  const burnTimerRef = useRef<number | null>(null);
  const syncTimersRef = useRef<number[]>([]);
  const joinGenerationRef = useRef(0);
  const rejectPollRef = useRef<number | null>(null);

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  const clearSyncTimers = useCallback(() => {
    for (const id of syncTimersRef.current) window.clearTimeout(id);
    syncTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      if (burnTimerRef.current !== null) window.clearTimeout(burnTimerRef.current);
      if (rejectPollRef.current !== null) window.clearInterval(rejectPollRef.current);
      clearSyncTimers();
      void joinedRef.current?.leave();
    };
  }, [clearSyncTimers]);

  const upsertMessage = useCallback((message: ForumMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.msgId === message.msgId)) return prev;
      return [...prev, message].sort((a, b) => a.createdAtMs - b.createdAtMs);
    });
  }, []);

  const runSync = useCallback(async () => {
    const session = joinedRef.current;
    if (!session) return;
    setIsSyncing(true);
    try {
      await session.requestSyncFromPeers();
      setRejectedSyncCount(session.getRejectedSyncCount());
    } catch {
      setRoomError({ key: 'errSync' });
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const scheduleSyncRetries = useCallback(() => {
    clearSyncTimers();
    for (const delayMs of [800, 2500, 6000]) {
      const id = window.setTimeout(() => {
        void runSync();
      }, delayMs);
      syncTimersRef.current.push(id);
    }
  }, [clearSyncTimers, runSync]);

  const joinRoomInternal = useCallback(
    async (params: RoomJoinParams) => {
      const roomIdTrim = params.roomId.trim();
      const phraseTrim = params.secretPhrase.trim();
      if (!roomIdTrim || !phraseTrim) {
        setJoinError({ key: 'errMissingFields' });
        return;
      }

      const generation = ++joinGenerationRef.current;
      setIsJoining(true);
      setJoinError(null);
      setRoomError(null);
      setBurnNotice(false);
      setRejectedSyncCount(0);
      clearSyncTimers();
      if (rejectPollRef.current !== null) {
        window.clearInterval(rejectPollRef.current);
        rejectPollRef.current = null;
      }

      setMessages([]);
      setPresence({});
      setOnlineUserIds([]);
      setProfile(null);
      setRoomId(null);
      setPhrase(null);

      try {
        if (joinedRef.current) {
          await joinedRef.current.leave();
          joinedRef.current = null;
          setJoined(null);
        }

        const session = await joinP2pRoom({
          roomId: roomIdTrim,
          password: phraseTrim,
          onForumMessage: (message) => {
            if (joinGenerationRef.current !== generation) return;
            upsertMessage(message);
          },
          onPresenceChange: (userId, state, removed) => {
            if (joinGenerationRef.current !== generation) return;
            setPresence((prev) => {
              const next = { ...prev };
              if (removed || !state) delete next[userId];
              else next[userId] = state;
              return next;
            });
          },
          onPeerPresence: (ids) => {
            if (joinGenerationRef.current !== generation) return;
            setOnlineUserIds(ids);
          },
          onUserJoined: () => {
            if (joinGenerationRef.current !== generation) return;
            void runSync();
          },
          onError: (code) => {
            if (joinGenerationRef.current !== generation) return;
            const key = mapRoomError(code);
            setRoomError({
              key,
              vars: key === 'errGeneric' ? { code } : undefined,
            });
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

        joinedRef.current = session;
        setJoined(session);
        setProfile(localProfile);
        setRoomId(roomIdTrim);
        setPhrase(phraseTrim);
        setPresence(session.getPresenceMap());
        setOnlineUserIds(session.getOnlineUserIds());
        onNavigateTab('forum');
        scheduleSyncRetries();

        rejectPollRef.current = window.setInterval(() => {
          const current = joinedRef.current;
          if (!current) return;
          setRejectedSyncCount(current.getRejectedSyncCount());
        }, 2000);
      } catch (err) {
        if (joinGenerationRef.current !== generation) return;
        if (err instanceof P2pActionError) {
          const key = mapRoomError(err.code);
          setJoinError(
            key === 'errGeneric'
              ? { key: 'errJoinFailed' }
              : { key, vars: undefined }
          );
        } else {
          setJoinError({ key: 'errJoinFailed' });
        }
        setJoined(null);
        setProfile(null);
        setRoomId(null);
        setPhrase(null);
      } finally {
        if (joinGenerationRef.current === generation) {
          setIsJoining(false);
        }
      }
    },
    [clearSyncTimers, onNavigateTab, runSync, scheduleSyncRetries, upsertMessage]
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

  const burnSession = useCallback(async () => {
    joinGenerationRef.current += 1;
    clearSyncTimers();
    if (rejectPollRef.current !== null) {
      window.clearInterval(rejectPollRef.current);
      rejectPollRef.current = null;
    }
    const current = joinedRef.current;
    if (current) {
      try {
        await current.leave();
      } catch {
        /* ignore */
      }
    }
    joinedRef.current = null;
    setJoined(null);
    setProfile(null);
    setRoomId(null);
    setPhrase(null);
    setMessages([]);
    setPresence({});
    setOnlineUserIds([]);
    setRejectedSyncCount(0);
    setRoomError(null);
    setJoinError(null);
    setBurnNotice(true);
    onNavigateTab('rooms');
    if (burnTimerRef.current !== null) window.clearTimeout(burnTimerRef.current);
    burnTimerRef.current = window.setTimeout(() => setBurnNotice(false), 4000);
  }, [clearSyncTimers, onNavigateTab]);

  const publish = useCallback(
    async (input: {
      type: ForumMessageType;
      threadId: string;
      parentMsgId: string | null;
      title: string;
      body: string;
    }) => {
      const session = joinedRef.current;
      if (!session) return;
      const title = input.title.slice(0, MAX_TITLE_CHARS);
      const body = input.body.slice(0, MAX_BODY_CHARS);
      if (!body.trim()) return;

      setIsPublishing(true);
      setRoomError(null);
      try {
        await session.publishEvent({
          msgId: crypto.randomUUID(),
          type: input.type,
          threadId: input.threadId,
          parentMsgId: input.parentMsgId,
          title,
          body,
          createdAtMs: Date.now(),
        });
      } catch (err) {
        if (err instanceof P2pActionError) {
          const key = mapRoomError(err.code);
          setRoomError({
            key: key === 'errGeneric' ? 'errPublish' : key,
            vars: key === 'errGeneric' ? { code: err.code } : undefined,
          });
        } else {
          setRoomError({ key: 'errPublish' });
        }
      } finally {
        setIsPublishing(false);
      }
    },
    []
  );

  const meshStatus: MeshStatus = useMemo(() => {
    if (isJoining) return 'connecting';
    if (!joined) return 'connecting';
    if (isSyncing) return 'syncing';
    if (onlineUserIds.length <= 1) return 'alone';
    return 'mesh';
  }, [isJoining, joined, isSyncing, onlineUserIds.length]);

  return {
    isInRoom: joined !== null,
    roomId,
    phrase,
    profile,
    selfUserId: joined?.selfUserId ?? null,
    isJoining,
    joinError,
    roomError,
    burnNotice,
    messages,
    presence,
    onlineUserIds,
    isPublishing,
    isSyncing,
    meshStatus,
    rejectedSyncCount,
    ipConsentNeeded,
    confirmIpConsent,
    cancelIpConsent,
    joinRoom,
    burnSession,
    publish,
    syncNow: runSync,
  };
}
