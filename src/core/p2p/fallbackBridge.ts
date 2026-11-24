import {
  signGoodbyeAttestation,
  signPresenceAttestation,
} from '../crypto/presenceAttest';
import type { SigningIdentity } from '../crypto/messageSigning';
import {
  MAX_DM_PER_MINUTE,
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
import { allowPeerAndGlobal, type PeerRateLimiter } from './rateLimit';
import type { PresenceKeys } from './presenceKeys';
import { deriveDmWrapKey, encryptDmWrap, tryDecryptDmWrapForSelf } from './roomCrypto';
import type { SyncVerify } from './syncVerify';
import type { JoinP2pRoomOptions } from './p2pTypes';

const MAX_GLOBAL_DM_PER_MINUTE = MAX_DM_PER_MINUTE * 3;

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
  /** Register dm-wrap retry when online set changes (join / fallback touch). */
  setOnOnlineMerged: (cb: (() => void) | null) => void;
  /** Peers with known enc keys — candidates for dm-wrap unwrap. */
  knownEncPubKeys: Map<string, string>;
  /** Online (WebRTC + fallback) userIds for dm-wrap peer guessing. */
  readOnlineUserIds: () => string[];
}

/** Cap HKDF tries per dm-wrap; prefer known-enc peers first. */
const DM_WRAP_CANDIDATE_CAP = 32;
const DM_WRAP_RETRY_TTL_MS = 15_000;
/** Bound pending unwrap queue (Nostr amp / failed blobs). */
const DM_WRAP_PENDING_CAP = 64;

function collectDmWrapCandidates(deps: FallbackBridgeDeps): string[] {
  const self = deps.self.userId;
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (!id || id === self || seen.has(id) || out.length >= DM_WRAP_CANDIDATE_CAP) return;
    seen.add(id);
    out.push(id);
  };
  for (const id of deps.knownEncPubKeys.keys()) push(id);
  for (const id of deps.fallbackPeers.listIds()) push(id);
  for (const id of deps.readOnlineUserIds()) push(id);
  return out;
}

export interface FallbackBridge {
  ensure: () => Promise<NostrFallbackBus | null>;
  publishPresence: (state: PresenceState) => Promise<void>;
  /** Returns false when no bus could be started or publish did not send. */
  publishForum: (event: ForumEvent, ensureIfNeeded?: boolean) => Promise<boolean>;
  /** Returns false when no bus could be started (caller should treat as undelivered). */
  publishDm: (dm: DirectMessage, ensureIfNeeded?: boolean) => Promise<boolean>;
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
  const pendingDmWraps: { blobB64: string; nostrPubkey: string; atMs: number }[] = [];

  const stopPresenceBeat = () => {
    if (fallbackPresenceTimer) clearTimeout(fallbackPresenceTimer);
    fallbackPresenceTimer = null;
  };

  const prunePendingDmWraps = () => {
    const now = Date.now();
    for (let i = pendingDmWraps.length - 1; i >= 0; i--) {
      if (now - pendingDmWraps[i]!.atMs > DM_WRAP_RETRY_TTL_MS) {
        pendingDmWraps.splice(i, 1);
      }
    }
  };

  let retryInFlight = false;
  /** Set when a hook fires while a retry batch is running — one follow-up, no tight loop. */
  let retryDirty = false;

  const retryPendingDmWraps = () => {
    if (deps.isLeft()) {
      pendingDmWraps.length = 0;
      retryDirty = false;
      return;
    }
    if (retryInFlight) {
      retryDirty = true;
      return;
    }
    prunePendingDmWraps();
    if (pendingDmWraps.length === 0) return;
    const candidates = collectDmWrapCandidates(deps);
    if (candidates.length === 0) return;
    const batch = pendingDmWraps.splice(0, pendingDmWraps.length);
    retryInFlight = true;
    retryDirty = false;
    void (async () => {
      try {
        for (const item of batch) {
          if (deps.isLeft()) {
            pendingDmWraps.length = 0;
            return;
          }
          if (Date.now() - item.atMs > DM_WRAP_RETRY_TTL_MS) continue;
          // Refresh candidates per item — keys/online may land mid-batch.
          const peers = collectDmWrapCandidates(deps);
          if (peers.length === 0) {
            if (Date.now() - item.atMs <= DM_WRAP_RETRY_TTL_MS) {
              pendingDmWraps.push(item);
            }
            continue;
          }
          const dm = await tryDecryptDmWrapForSelf(
            deps.roomId,
            deps.password,
            deps.self.userId,
            peers,
            item.blobB64
          );
          if (dm) {
            await deps.dmIngest.accept(dm, null);
          } else if (Date.now() - item.atMs <= DM_WRAP_RETRY_TTL_MS) {
            pendingDmWraps.push(item);
          }
        }
      } finally {
        retryInFlight = false;
        // Only re-run if a hook fired mid-batch (new keys/online) — never spin on decrypt fails.
        if (retryDirty && !deps.isLeft()) {
          retryDirty = false;
          retryPendingDmWraps();
        }
      }
    })();
  };

  // Primary hooks: enc keys + online merge (beat is backup; beat alone can exceed TTL).
  deps.presenceKeys.setOnKnownEncUpdated(retryPendingDmWraps);
  deps.setOnOnlineMerged(retryPendingDmWraps);

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

  const publishForum = async (
    event: ForumEvent,
    ensureIfNeeded = false
  ): Promise<boolean> => {
    const bus = await resolveBus(ensureIfNeeded);
    if (!bus || deps.isLeft()) return false;
    return bus.publish({ v: 2, t: 'forum', event });
  };

  const publishDm = async (dm: DirectMessage, ensureIfNeeded = false): Promise<boolean> => {
    const bus = await resolveBus(ensureIfNeeded);
    if (!bus || deps.isLeft()) return false;
    const wrapKey = await deriveDmWrapKey(
      deps.roomId,
      deps.password,
      dm.fromUserId,
      dm.toUserId
    );
    const blobB64 = await encryptDmWrap(wrapKey, dm, deps.roomId);
    return bus.publish({ v: 3, t: 'dm-wrap', blobB64 });
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
          }),
          {
            getDmPeerCandidates: () => collectDmWrapCandidates(deps),
            allowDmWrapAttempt: (nostrPubkey) =>
              allowPeerAndGlobal(
                deps.dmRateLimiter,
                `nostr:${nostrPubkey}`,
                MAX_DM_PER_MINUTE,
                '__global_fallback_dm__',
                MAX_GLOBAL_DM_PER_MINUTE
              ),
            onDmWrapPending: (blobB64, nostrPubkey) => {
              if (pendingDmWraps.some((p) => p.blobB64 === blobB64)) return;
              if (pendingDmWraps.length >= DM_WRAP_PENDING_CAP) {
                pendingDmWraps.shift();
              }
              pendingDmWraps.push({ blobB64, nostrPubkey, atMs: Date.now() });
              prunePendingDmWraps();
            },
          }
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
              // Backup retry (primary path: PresenceKeys.onKnownEncUpdated).
              retryPendingDmWraps();
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
        retryPendingDmWraps();
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
    deps.presenceKeys.setOnKnownEncUpdated(null);
    deps.setOnOnlineMerged(null);
    pendingDmWraps.length = 0;
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
