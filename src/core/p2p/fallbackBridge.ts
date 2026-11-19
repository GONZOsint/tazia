import {
  signGoodbyeAttestation,
  signPresenceAttestation,
} from '../crypto/presenceAttest';
import type { SigningIdentity } from '../crypto/messageSigning';
import {
  isValidPresenceState,
  type DirectMessage,
  type ForumEvent,
  type PresenceState,
} from '../protocol';
import type { TrustStore } from '../trust/trustStore';
import type { DmIngest } from './dmIngest';
import { buildFallbackHandlers } from './fallbackIngress';
import type { FallbackPeerSet } from './fallbackPeerSet';
import type { ForumIngest } from './forumIngest';
import {
  startNostrFallback,
  type NostrFallbackBus,
} from './nostrFallback';
import type { PeerRateLimiter } from './rateLimit';
import type { PresenceKeys } from './presenceKeys';
import type { SyncVerify } from './syncVerify';
import type { JoinP2pRoomOptions } from './p2pTypes';

export type { FallbackPeerSet } from './fallbackPeerSet';
export { createFallbackPeerSet } from './fallbackPeerSet';

export interface FallbackBridgeDeps {
  roomId: string;
  password: string;
  self: { userId: string };
  signing: SigningIdentity;
  trustStore: TrustStore;
  forumIngest: ForumIngest;
  dmIngest: DmIngest;
  presenceKeys: PresenceKeys;
  syncVerify: SyncVerify;
  rateLimiter: PeerRateLimiter;
  dmRateLimiter: PeerRateLimiter;
  presenceRateLimiter: PeerRateLimiter;
  fallbackPeers: FallbackPeerSet;
  options: JoinP2pRoomOptions;
  isLeft: () => boolean;
  getLastPresence: () => PresenceState | null;
  isLiveWebrtc: (userId: string) => boolean;
  mergeOnline: () => void;
}

export interface FallbackBridge {
  ensure: () => Promise<NostrFallbackBus | null>;
  publishPresence: (state: PresenceState) => Promise<void>;
  publishForum: (event: ForumEvent, ensureIfNeeded?: boolean) => Promise<void>;
  publishDm: (dm: DirectMessage, ensureIfNeeded?: boolean) => Promise<void>;
  requestNostrSync: () => Promise<number>;
  getBus: () => NostrFallbackBus | null;
  stopPresenceBeat: () => void;
  /** Await in-flight ensure, claim bus, publish goodbye, stop — leave-safe. */
  shutdownForLeave: (encPubKeyRawB64: string) => Promise<void>;
}

export function createFallbackBridge(deps: FallbackBridgeDeps): FallbackBridge {
  let fallback: NostrFallbackBus | null = null;
  let fallbackStarting: Promise<void> | null = null;
  let fallbackPresenceTimer: ReturnType<typeof setTimeout> | null = null;

  const stopPresenceBeat = () => {
    if (fallbackPresenceTimer) clearTimeout(fallbackPresenceTimer);
    fallbackPresenceTimer = null;
  };

  const publishPresence = async (state: PresenceState) => {
    if (!fallback || deps.isLeft()) return;
    const atMs = Date.now();
    if (!state.avatarSeed) return;
    const attestSig = await signPresenceAttestation(
      deps.signing,
      deps.roomId,
      deps.self.userId,
      state.signPubKeySpkiB64,
      state.encPubKeyRawB64,
      atMs,
      state.alias,
      state.avatarSeed
    );
    await fallback.publish({
      v: 2,
      t: 'presence',
      userId: deps.self.userId,
      state,
      atMs,
      attestSig,
    });
  };

  const resolveBus = async (ensureIfNeeded: boolean): Promise<NostrFallbackBus | null> => {
    if (fallback) return fallback;
    if (!ensureIfNeeded || deps.isLeft()) return null;
    return ensure();
  };

  const publishForum = async (event: ForumEvent, ensureIfNeeded = false) => {
    const bus = await resolveBus(ensureIfNeeded);
    if (!bus || deps.isLeft()) return;
    await bus.publish({ v: 2, t: 'forum', event });
  };

  const publishDm = async (dm: DirectMessage, ensureIfNeeded = false) => {
    const bus = await resolveBus(ensureIfNeeded);
    if (!bus || deps.isLeft()) return;
    await bus.publish({ v: 2, t: 'dm', dm });
  };

  const claimBusForLeave = async (): Promise<NostrFallbackBus | null> => {
    stopPresenceBeat();
    if (fallbackStarting) await fallbackStarting;
    const bus = fallback;
    fallback = null;
    return bus;
  };

  const ensure = async (): Promise<NostrFallbackBus | null> => {
    if (deps.isLeft()) return null;
    if (fallback) return fallback;
    if (fallbackStarting) {
      await fallbackStarting;
      return deps.isLeft() ? null : fallback;
    }
    fallbackStarting = (async () => {
      try {
        const bus = await startNostrFallback(
          deps.roomId,
          deps.password,
          deps.self.userId,
          buildFallbackHandlers({
            roomId: deps.roomId,
            trustStore: deps.trustStore,
            forumIngest: deps.forumIngest,
            dmIngest: deps.dmIngest,
            presenceKeys: deps.presenceKeys,
            syncVerify: deps.syncVerify,
            rateLimiter: deps.rateLimiter,
            dmRateLimiter: deps.dmRateLimiter,
            presenceRateLimiter: deps.presenceRateLimiter,
            fallbackPeers: deps.fallbackPeers,
            options: deps.options,
            isLeft: deps.isLeft,
          })
        );

        // Leave raced start — stop orphan sockets and do not retain the bus.
        if (deps.isLeft()) {
          bus.stop();
          fallback = null;
          return;
        }

        fallback = bus;

        if (!fallbackPresenceTimer) {
          const schedulePresenceBeat = () => {
            const delay = 12_000 + Math.floor(Math.random() * 4_000);
            fallbackPresenceTimer = setTimeout(() => {
              if (deps.isLeft() || !fallback) return;
              if (deps.fallbackPeers.pruneStale(deps.isLiveWebrtc)) {
                deps.mergeOnline();
              }
              const last = deps.getLastPresence();
              if (last && isValidPresenceState(last)) {
                void publishPresence(last);
              }
              schedulePresenceBeat();
            }, delay);
          };
          schedulePresenceBeat();
        }

        const last = deps.getLastPresence();
        if (last && isValidPresenceState(last)) {
          await publishPresence(last);
        }
      } catch {
        fallback = null;
        deps.options.onError('unknown', 'Nostr fallback failed to start');
      } finally {
        fallbackStarting = null;
      }
    })();
    await fallbackStarting;
    return deps.isLeft() ? null : fallback;
  };

  const shutdownForLeave = async (encPubKeyRawB64: string) => {
    const bus = await claimBusForLeave();
    if (!bus) return;
    try {
      const atMs = Date.now();
      const goodbyeSig = await signGoodbyeAttestation(
        deps.signing,
        deps.roomId,
        deps.self.userId,
        deps.signing.publicKeySpkiB64,
        encPubKeyRawB64,
        atMs
      );
      await bus.publish({
        v: 2,
        t: 'goodbye',
        userId: deps.self.userId,
        atMs,
        signPubKeySpkiB64: deps.signing.publicKeySpkiB64,
        encPubKeyRawB64,
        attestSig: goodbyeSig,
      });
    } catch {
      /* ignore */
    }
    bus.stop();
  };

  return {
    ensure,
    publishPresence,
    publishForum,
    publishDm,
    requestNostrSync: async () => {
      const bus = await ensure();
      if (!bus) return 0;
      return deps.syncVerify.beginNostrSyncRequest((env) => bus.publish(env));
    },
    getBus: () => fallback,
    stopPresenceBeat,
    shutdownForLeave,
  };
}
