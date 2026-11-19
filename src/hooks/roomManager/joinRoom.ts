import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { buildLocalProfile } from '../../core/crypto/identity';
import { evaluatePassphraseStrength } from '../../core/crypto/passphraseWords';
import { P2pActionError } from '../../core/p2p/p2pTypes';
import {
  primeLocalNetworkAccess,
  queryLocalNetworkAccess,
} from '../../core/p2p/localNetworkAccess';
import { MAX_ALIAS_CHARS } from '../../core/protocol';
import { buildRtcConfig } from '../../features/rooms/TurnRelaySettings';
import { mapRoomError, type SessionError } from '../sessionErrors';
import {
  deriveMeshStatus,
  MAX_ROOMS,
  type RoomJoinParams,
  type RoomState,
} from '../roomManagerTypes';
import { buildP2pCallbacks } from './p2pCallbacks';
import { schedulePostJoinSync, type SyncEngineRefs } from './syncEngine';

export type JoinRoomDeps = {
  roomsRef: MutableRefObject<Map<string, RoomState>>;
  activeRoomIdRef: MutableRefObject<string | null>;
  joinTokensRef: MutableRefObject<Map<string, number>>;
  isJoiningRef: MutableRefObject<boolean>;
  /** Bumped each time a join attempt claims the global joining lock. */
  joinGenerationRef: MutableRefObject<number>;
  forumFocusedRef?: MutableRefObject<boolean>;
  dmsFocusedRef?: MutableRefObject<boolean>;
  activeDmPeerIdRef?: MutableRefObject<string | null>;
  onZoneIgnitedRef: MutableRefObject<
    ((roomId: string, meta: { firstZone: boolean }) => void) | undefined
  >;
  syncRefs: SyncEngineRefs;
  updateRoom: (roomId: string, updater: (prev: RoomState) => RoomState) => void;
  setRooms: Dispatch<SetStateAction<Map<string, RoomState>>>;
  setActiveRoomId: Dispatch<SetStateAction<string | null>>;
  setIsJoining: Dispatch<SetStateAction<boolean>>;
  setJoinError: Dispatch<SetStateAction<SessionError>>;
  onNavigateTab: (tab: 'forum' | 'rooms' | 'presence') => void;
};

function bumpJoinToken(joinTokensRef: MutableRefObject<Map<string, number>>, roomId: string) {
  const next = (joinTokensRef.current.get(roomId) ?? 0) + 1;
  joinTokensRef.current.set(roomId, next);
  return next;
}

function isJoinTokenCurrent(
  joinTokensRef: MutableRefObject<Map<string, number>>,
  roomId: string,
  token: number
) {
  return joinTokensRef.current.get(roomId) === token;
}

export async function joinRoomInternal(deps: JoinRoomDeps, params: RoomJoinParams) {
  const {
    roomsRef,
    joinTokensRef,
    isJoiningRef,
    joinGenerationRef,
    forumFocusedRef,
    dmsFocusedRef,
    activeDmPeerIdRef,
    activeRoomIdRef,
    onZoneIgnitedRef,
    syncRefs,
    updateRoom,
    setRooms,
    setActiveRoomId,
    setIsJoining,
    setJoinError,
    onNavigateTab,
  } = deps;

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

  const token = bumpJoinToken(joinTokensRef, roomIdTrim);
  const generation = ++joinGenerationRef.current;
  isJoiningRef.current = true;
  setIsJoining(true);
  setJoinError(null);

  try {
    const { rtcConfig, turnConfig, relayOnly } = buildRtcConfig();
    const lna = await queryLocalNetworkAccess();
    if (lna !== 'granted') {
      await primeLocalNetworkAccess(lna === 'unsupported' ? 250 : 400);
    }

    const { joinP2pRoom } = await import('../../core/p2p/p2pRoom');
    if (!isJoinTokenCurrent(joinTokensRef, roomIdTrim, token)) return;

    const callbacks = buildP2pCallbacks({
      roomId: roomIdTrim,
      roomsRef,
      activeRoomIdRef,
      forumFocusedRef,
      dmsFocusedRef,
      activeDmPeerIdRef,
      updateRoom,
      syncRefs,
    });

    const session = await joinP2pRoom({
      roomId: roomIdTrim,
      password: phraseTrim,
      rtcConfig,
      turnConfig,
      relayOnly,
      ...callbacks,
    });

    if (!isJoinTokenCurrent(joinTokensRef, roomIdTrim, token)) {
      await session.leave();
      return;
    }

    const localProfile = await buildLocalProfile(
      session.selfUserId,
      params.customAlias?.trim().slice(0, MAX_ALIAS_CHARS)
    );
    await session.setPresenceProfile(localProfile.alias, localProfile.avatarSeed);

    if (!isJoinTokenCurrent(joinTokensRef, roomIdTrim, token)) {
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

    schedulePostJoinSync(syncRefs, roomIdTrim);
  } catch (err) {
    if (!isJoinTokenCurrent(joinTokensRef, roomIdTrim, token)) return;
    if (err instanceof P2pActionError) {
      const key = mapRoomError(err.code);
      setJoinError(key === 'errGeneric' ? { key: 'errJoinFailed' } : { key });
    } else {
      setJoinError({ key: 'errJoinFailed' });
    }
  } finally {
    // Clear only if this attempt still owns the lock (stale-token cancel OK;
    // a newer join/burn generation must not be clobbered).
    if (joinGenerationRef.current === generation) {
      isJoiningRef.current = false;
      setIsJoining(false);
    }
  }
}

export { bumpJoinToken, isJoinTokenCurrent };
