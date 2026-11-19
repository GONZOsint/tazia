import {
  generateSigningIdentity,
  wipeSigningIdentity,
  type SigningIdentity,
} from '../crypto/messageSigning';
import {
  generateEncryptionIdentity,
  wipeEncryptionIdentity,
  type EncryptionIdentity,
} from '../crypto/dmCrypto';
import { createP2pOnlineCoordinator } from './p2pOnline';
import { createP2pSubsystems, type P2pSessionBag } from './p2pSubsystems';
import { buildJoinedP2pRoomActions } from './p2pRoomActions';
import {
  P2pActionError,
  type JoinP2pRoomOptions,
  type JoinedP2pRoom,
} from './p2pTypes';
import { openTrysteroRoom } from './trysteroConnect';
import { wireTrysteroIngress } from './trysteroIngress';
import type { FallbackPeerSet } from './fallbackPeerSet';

export type { JoinedP2pRoom, JoinP2pRoomOptions, P2pRoomErrorCode } from './p2pTypes';
export { P2pActionError } from './p2pTypes';

export async function joinP2pRoom(options: JoinP2pRoomOptions): Promise<JoinedP2pRoom> {
  const roomId = options.roomId.trim();
  const password = options.password.trim();

  const signing: SigningIdentity = await generateSigningIdentity();
  const encIdentity: EncryptionIdentity | null = await generateEncryptionIdentity();
  if (!encIdentity) {
    wipeSigningIdentity(signing);
    throw new P2pActionError('unknown', 'X25519 required for TAZEP Susurros');
  }

  const selfRef = { userId: '' };
  const knownEncPubKeys = new Map<string, string>();
  const session: P2pSessionBag = {
    left: false,
    relayFallbackNotified: false,
    lastPresence: null,
  };
  const pruneTimer = { current: null as ReturnType<typeof setInterval> | null };

  let fallbackPeersHolder: (FallbackPeerSet & { map: Map<string, number> }) | null = null;

  const online = createP2pOnlineCoordinator({
    self: selfRef,
    getFallbackPeers: () => {
      if (!fallbackPeersHolder) {
        throw new Error('fallback peers not ready');
      }
      return fallbackPeersHolder;
    },
    onPresenceChange: options.onPresenceChange,
    onPeerPresence: options.onPeerPresence,
  });

  const core = createP2pSubsystems({
    roomId,
    password,
    signing,
    encIdentity,
    options,
    online,
    session,
    selfRef,
    knownEncPubKeys,
  });
  fallbackPeersHolder = core.fallbackPeers;

  let opened;
  try {
    opened = await openTrysteroRoom(roomId, password, options);
  } catch (err) {
    wipeSigningIdentity(signing);
    wipeEncryptionIdentity(encIdentity);
    throw err;
  }

  const { room, self } = opened;
  online.setRoom(room);
  selfRef.userId = self.userId;
  online.peerFirstSeenAtMs.set(self.userId, Date.now());
  knownEncPubKeys.set(self.userId, encIdentity.publicKeyRawB64);
  await core.registry.observe(
    self.userId,
    signing.publicKeySpkiB64,
    encIdentity.publicKeyRawB64
  );
  core.presenceKeys.markSelfWebrtcPinned(self.userId);

  // Start prune only after successful connect (avoids leak on join failure).
  pruneTimer.current = setInterval(() => {
    core.rateLimiter.pruneStale();
    core.syncAnswerLimiter.pruneStale();
    core.dmRateLimiter.pruneStale();
    core.presenceRateLimiter.pruneStale();
  }, 5 * 60_000);

  const { actions, unsubs } = wireTrysteroIngress({
    room,
    forumIngest: core.forumIngest,
    dmIngest: core.dmIngest,
    dmRateLimiter: core.dmRateLimiter,
    syncVerify: core.syncVerify,
    presenceKeys: core.presenceKeys,
    fallbackBridge: core.fallbackBridge,
    online,
    options,
    session,
  });

  online.mergeOnline();

  const methods = buildJoinedP2pRoomActions({
    roomId,
    room,
    signing,
    encIdentity,
    options,
    session,
    online,
    actions,
    unsubs,
    pruneTimer,
    trustStore: core.trustStore,
    rateLimiter: core.rateLimiter,
    syncAnswerLimiter: core.syncAnswerLimiter,
    dmRateLimiter: core.dmRateLimiter,
    presenceRateLimiter: core.presenceRateLimiter,
    knownEncPubKeys,
    selfRef,
    registry: core.registry,
    forumIngest: core.forumIngest,
    dmIngest: core.dmIngest,
    syncVerify: core.syncVerify,
    fallbackBridge: core.fallbackBridge,
  });

  return {
    selfUserId: self.userId,
    signPubKeySpkiB64: signing.publicKeySpkiB64,
    trustStore: core.trustStore,
    ...methods,
  };
}
