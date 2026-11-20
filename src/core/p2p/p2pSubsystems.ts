import type { EncryptionIdentity } from '../crypto/dmCrypto';
import type { SigningIdentity } from '../crypto/messageSigning';
import { TrustStore } from '../trust/trustStore';
import { DmIngest } from './dmIngest';
import { createFallbackBridge, type FallbackBridge } from './fallbackBridge';
import { createFallbackPeerSet, type FallbackPeerSet } from './fallbackPeerSet';
import { ForumIngest } from './forumIngest';
import type { P2pOnlineCoordinator } from './p2pOnline';
import type { JoinP2pRoomOptions } from './p2pTypes';
import { PresenceKeys } from './presenceKeys';
import { PeerRateLimiter } from './rateLimit';
import { SyncVerify } from './syncVerify';
import { VerifyKeyRegistry } from './verifyKeyRegistry';
import type { PresenceState } from '../protocol';

export type P2pSessionBag = {
  left: boolean;
  relayFallbackNotified: boolean;
  lastPresence: PresenceState | null;
};

export type P2pSubsystems = {
  trustStore: TrustStore;
  rateLimiter: PeerRateLimiter;
  syncAnswerLimiter: PeerRateLimiter;
  dmRateLimiter: PeerRateLimiter;
  presenceRateLimiter: PeerRateLimiter;
  knownEncPubKeys: Map<string, string>;
  selfRef: { userId: string };
  fallbackPeers: FallbackPeerSet & { map: Map<string, number> };
  registry: VerifyKeyRegistry;
  forumIngest: ForumIngest;
  dmIngest: DmIngest;
  presenceKeys: PresenceKeys;
  syncVerify: SyncVerify;
  fallbackBridge: FallbackBridge;
  online: P2pOnlineCoordinator;
  session: P2pSessionBag;
};

export function createP2pSubsystems(input: {
  roomId: string;
  password: string;
  signing: SigningIdentity;
  encIdentity: EncryptionIdentity;
  options: JoinP2pRoomOptions;
  online: P2pOnlineCoordinator;
  session: P2pSessionBag;
  selfRef: { userId: string };
  knownEncPubKeys: Map<string, string>;
}): Omit<P2pSubsystems, 'online' | 'session' | 'selfRef' | 'knownEncPubKeys'> & {
  trustStore: TrustStore;
  rateLimiter: PeerRateLimiter;
  syncAnswerLimiter: PeerRateLimiter;
  dmRateLimiter: PeerRateLimiter;
  presenceRateLimiter: PeerRateLimiter;
  fallbackPeers: FallbackPeerSet & { map: Map<string, number> };
  registry: VerifyKeyRegistry;
  forumIngest: ForumIngest;
  dmIngest: DmIngest;
  presenceKeys: PresenceKeys;
  syncVerify: SyncVerify;
  fallbackBridge: FallbackBridge;
} {
  const trustStore = new TrustStore();
  const rateLimiter = new PeerRateLimiter();
  const syncAnswerLimiter = new PeerRateLimiter();
  const dmRateLimiter = new PeerRateLimiter();
  const presenceRateLimiter = new PeerRateLimiter();

  let forumIngest!: ForumIngest;
  let dmIngest!: DmIngest;
  let presenceKeys!: PresenceKeys;
  let syncVerify!: SyncVerify;

  const fallbackPeers = createFallbackPeerSet(
    input.selfRef,
    input.options.onPresenceChange,
    () => input.online.mergeOnlineRef.current()
  );

  const registry = new VerifyKeyRegistry({
    trustStore,
    onKeyChange: input.options.onKeyChange,
    onKeysReady: (userId) => {
      void forumIngest.flushPendingForUser(userId);
    },
  });

  forumIngest = new ForumIngest({
    rateLimiter,
    registry,
    onForumMessage: input.options.onForumMessage,
    onThreadDeleted: input.options.onThreadDeleted,
    getOnlineUserIds: () => input.online.readOnlineUserIds(),
    peerFirstSeenAtMs: (userId) => input.online.peerFirstSeenAtMs.get(userId),
    onRejectedSync: () => {
      syncVerify.noteRejected();
      input.options.onRejectedSync?.();
    },
  });

  dmIngest = new DmIngest({
    roomId: input.roomId,
    self: input.selfRef,
    encIdentity: input.encIdentity,
    knownEncPubKeys: input.knownEncPubKeys,
    registry,
    onDirectMessage: input.options.onDirectMessage,
  });

  presenceKeys = new PresenceKeys({
    trustStore,
    registry,
    knownEncPubKeys: input.knownEncPubKeys,
    dmIngest,
  });

  syncVerify = new SyncVerify({
    roomId: input.roomId,
    self: input.selfRef,
    signing: input.signing,
    registry,
    forumIngest,
    syncAnswerLimiter,
    getEventsForSync: () => forumIngest.getEventsForSync(),
    // Counter already bumped in SyncVerify.rejectOnce — only refresh RoomState.
    onRejectedSync: () => input.options.onRejectedSync?.(),
  });

  const fallbackBridge = createFallbackBridge({
    roomId: input.roomId,
    password: input.password,
    self: input.selfRef,
    signing: input.signing,
    trustStore,
    forumIngest,
    dmIngest,
    presenceKeys,
    syncVerify,
    rateLimiter,
    dmRateLimiter,
    presenceRateLimiter,
    fallbackPeers,
    options: input.options,
    isLeft: () => input.session.left,
    getLastPresence: () => input.session.lastPresence,
    isLiveWebrtc: input.online.isLiveWebrtc,
    mergeOnline: () => input.online.mergeOnline(),
    knownEncPubKeys: input.knownEncPubKeys,
    readOnlineUserIds: () => input.online.readOnlineUserIds(),
  });

  return {
    trustStore,
    rateLimiter,
    syncAnswerLimiter,
    dmRateLimiter,
    presenceRateLimiter,
    fallbackPeers,
    registry,
    forumIngest,
    dmIngest,
    presenceKeys,
    syncVerify,
    fallbackBridge,
  };
}
