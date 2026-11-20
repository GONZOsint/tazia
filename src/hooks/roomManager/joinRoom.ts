import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { buildLocalProfile } from '../../core/crypto/identity';
import { evaluatePassphraseStrength } from '../../core/crypto/passphraseWords';
import { P2pActionError, type JoinedP2pRoom } from '../../core/p2p/p2pTypes';
import {
  primeLocalNetworkAccess,
  queryLocalNetworkAccess,
} from '../../core/p2p/localNetworkAccess';
import { normalizePresenceAlias } from '../../core/p2p/p2pPresenceState';
import { clearInvitePhraseLatch } from '../../core/utils/inviteLink';
import { buildRtcConfig } from '../../features/rooms/TurnRelaySettings';
import { buildNostrRelayUrls } from '../../features/rooms/nostrRelayConfig';
import { mapRoomError, type SessionError } from '../sessionErrors';
import {
  deriveMeshStatus,
  MAX_ROOMS,
  type RoomJoinParams,
  type RoomState,
} from '../roomManagerTypes';
import { appendDmMessage } from './dmTranscript';
import { buildP2pCallbacks } from './p2pCallbacks';
import { schedulePostJoinSync, type SyncEngineRefs } from './syncEngine';
import type { DirectMessage } from '../../core/protocol';

export type JoinRoomDeps = {
  roomsRef: MutableRefObject<Map<string, RoomState>>;
  activeRoomIdRef: MutableRefObject<string | null>;
  joinTokensRef: MutableRefObject<Map<string, number>>;
  isJoiningRef: MutableRefObject<boolean>;
  /** Bumped each time a join attempt claims the global joining lock. */
  joinGenerationRef: MutableRefObject<number>;
  /** True while session extinguish countdown / burn is in progress. */
  tearingDownRef?: MutableRefObject<boolean>;
  /** Room IDs with session.leave() still running after map drop. */
  leavingRoomIdsRef?: MutableRefObject<Set<string>>;
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
    tearingDownRef,
    leavingRoomIdsRef,
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

  if (tearingDownRef?.current) {
    setJoinError({ key: 'errJoinBusy' });
    return;
  }

  const roomIdTrim = params.roomId.trim();
  const phraseTrim = params.secretPhrase.trim();
  if (!roomIdTrim || !phraseTrim) {
    setJoinError({ key: 'errMissingFields' });
    return;
  }

  if (leavingRoomIdsRef?.current.has(roomIdTrim)) {
    setJoinError({ key: 'errJoinBusy' });
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
    // Abandon any in-flight join so it cannot steal the active zone after this switch.
    if (isJoiningRef.current) {
      joinGenerationRef.current += 1;
      for (const id of joinTokensRef.current.keys()) bumpJoinToken(joinTokensRef, id);
      isJoiningRef.current = false;
      setIsJoining(false);
    }
    setJoinError(null);
    clearInvitePhraseLatch(roomIdTrim);
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

  let session: JoinedP2pRoom | null = null;
  let sessionReleased = false;
  const releaseSession = async () => {
    if (!session || sessionReleased) return;
    sessionReleased = true;
    try {
      await session.leave();
    } catch {
      /* best-effort teardown */
    }
  };

  try {
    const { rtcConfig, turnConfig, relayOnly } = buildRtcConfig();
    const relayUrls = buildNostrRelayUrls();
    const lna = await queryLocalNetworkAccess();
    if (lna !== 'granted') {
      await primeLocalNetworkAccess(lna === 'unsupported' ? 250 : 400);
    }

    const { joinP2pRoom } = await import('../../core/p2p/p2pRoom');
    if (
      !isJoinTokenCurrent(joinTokensRef, roomIdTrim, token) ||
      joinGenerationRef.current !== generation ||
      tearingDownRef?.current
    ) {
      return;
    }

    const callbacks = buildP2pCallbacks({
      roomId: roomIdTrim,
      joinToken: token,
      joinTokensRef,
      roomsRef,
      activeRoomIdRef,
      forumFocusedRef,
      dmsFocusedRef,
      activeDmPeerIdRef,
      updateRoom,
      syncRefs,
    });

    session = await joinP2pRoom({
      roomId: roomIdTrim,
      password: phraseTrim,
      rtcConfig,
      turnConfig,
      relayOnly,
      relayUrls,
      ...callbacks,
    });

    if (
      !isJoinTokenCurrent(joinTokensRef, roomIdTrim, token) ||
      joinGenerationRef.current !== generation ||
      tearingDownRef?.current
    ) {
      await releaseSession();
      return;
    }

    const customAlias = params.customAlias
      ? normalizePresenceAlias(params.customAlias)
      : null;
    const localProfile = await buildLocalProfile(
      session.selfUserId,
      customAlias ?? undefined
    );
    await session.setPresenceProfile(localProfile.alias, localProfile.avatarSeed);

    if (
      !isJoinTokenCurrent(joinTokensRef, roomIdTrim, token) ||
      joinGenerationRef.current !== generation ||
      tearingDownRef?.current
    ) {
      await releaseSession();
      return;
    }

    const buildDmMessages = (dms: DirectMessage[]): Record<string, DirectMessage[]> => {
      const dmMessages: Record<string, DirectMessage[]> = {};
      for (const dm of dms) {
        const peerId = dm.fromUserId === session!.selfUserId ? dm.toUserId : dm.fromUserId;
        const next = appendDmMessage(dmMessages[peerId] ?? [], dm);
        if (next) dmMessages[peerId] = next;
      }
      return dmMessages;
    };

    const roomState: RoomState = {
      roomId: roomIdTrim,
      phrase: phraseTrim,
      profile: localProfile,
      selfUserId: session.selfUserId,
      selfSignPubKeyB64: session.signPubKeySpkiB64,
      trustStore: session.trustStore,
      session,
      messages: session.getForumSnapshot(),
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
      dmMessages: buildDmMessages(session.getDmSnapshot()),
      dmUnread: {},
    };

    const isAdditionalZone = roomsRef.current.size > 0;

    // Re-check after building state — switchRoom/burn may have invalidated us.
    if (
      !isJoinTokenCurrent(joinTokensRef, roomIdTrim, token) ||
      joinGenerationRef.current !== generation ||
      tearingDownRef?.current
    ) {
      await releaseSession();
      return;
    }

    // Re-snapshot immediately before commit — live ingest can land while we built
    // roomState; callbacks bail until the room is in roomsRef, and re-ingest is a no-op.
    roomState.messages = session.getForumSnapshot();
    roomState.dmMessages = buildDmMessages(session.getDmSnapshot());
    roomState.presence = session.getPresenceMap();
    roomState.onlineUserIds = session.getOnlineUserIds();
    roomState.meshStatus = deriveMeshStatus({
      isSyncing: true,
      onlineUserIds: roomState.onlineUserIds,
      selfUserId: session.selfUserId,
    });

    setRooms((prev) => {
      const next = new Map(prev);
      next.set(roomIdTrim, roomState);
      roomsRef.current = next;
      return next;
    });

    // Final guard after commit — burn/switch may have raced past the pre-setRooms checks.
    if (
      !isJoinTokenCurrent(joinTokensRef, roomIdTrim, token) ||
      joinGenerationRef.current !== generation ||
      tearingDownRef?.current
    ) {
      await releaseSession();
      const rolled = new Map(roomsRef.current);
      rolled.delete(roomIdTrim);
      roomsRef.current = rolled;
      setRooms(rolled);
      setActiveRoomId((cur) => (cur === roomIdTrim ? ([...rolled.keys()][0] ?? null) : cur));
      return;
    }

    setActiveRoomId(roomIdTrim);
    clearInvitePhraseLatch(roomIdTrim);
    onNavigateTab(isAdditionalZone ? 'rooms' : 'forum');
    onZoneIgnitedRef.current?.(roomIdTrim, { firstZone: !isAdditionalZone });

    schedulePostJoinSync(syncRefs, roomIdTrim);
  } catch (err) {
    clearInvitePhraseLatch(roomIdTrim);
    if (!isJoinTokenCurrent(joinTokensRef, roomIdTrim, token)) return;
    if (err instanceof P2pActionError) {
      const key = mapRoomError(err.code);
      setJoinError(key === 'errGeneric' ? { key: 'errJoinFailed' } : { key });
    } else {
      setJoinError({ key: 'errJoinFailed' });
    }
  } finally {
    // Tear down orphan mesh if join never committed (or rolled back) into roomsRef.
    if (session && !roomsRef.current.has(roomIdTrim)) {
      await releaseSession();
    }
    // Clear only if this attempt still owns the lock (stale-token cancel OK;
    // a newer join/burn generation must not be clobbered).
    if (joinGenerationRef.current === generation) {
      isJoiningRef.current = false;
      setIsJoining(false);
    }
  }
}

export { bumpJoinToken, isJoinTokenCurrent };
