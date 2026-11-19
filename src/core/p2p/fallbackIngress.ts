import {
  verifyGoodbyeAttestation,
  verifyPresenceAttestation,
} from '../crypto/presenceAttest';
import {
  MAX_DM_PER_MINUTE,
  MAX_PRESENCE_PER_MINUTE,
  MAX_PUBLISH_PER_MINUTE,
  isValidPresenceState,
} from '../protocol';
import type { TrustStore } from '../trust/trustStore';
import type { DmIngest } from './dmIngest';
import type { FallbackPeerSet } from './fallbackPeerSet';
import type { ForumIngest } from './forumIngest';
import type { NostrFallbackHandlers } from './nostrFallback';
import type { PeerRateLimiter } from './rateLimit';
import type { PresenceKeys } from './presenceKeys';
import type { SyncVerify } from './syncVerify';
import type { JoinP2pRoomOptions } from './p2pTypes';

const MAX_GLOBAL_DM_PER_MINUTE = MAX_DM_PER_MINUTE * 3;
const MAX_GLOBAL_FALLBACK_FORUM_PER_MINUTE = MAX_PUBLISH_PER_MINUTE * 3;
const MAX_GLOBAL_PRESENCE_PER_MINUTE = MAX_PRESENCE_PER_MINUTE * 3;

export interface FallbackIngressDeps {
  roomId: string;
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
}

function allowPeerAndGlobal(
  limiter: PeerRateLimiter,
  peerKey: string,
  globalKey: string,
  peerMax: number,
  globalMax: number
): boolean {
  if (!limiter.allow(peerKey, peerMax)) return false;
  if (!limiter.allow(globalKey, globalMax)) return false;
  return true;
}

/** Build Nostr inbound handlers (rate limits, attest, ingest, sync). */
export function buildFallbackHandlers(deps: FallbackIngressDeps): NostrFallbackHandlers {
  return {
    onForum: (event, nostrPubkey) => {
      if (
        !allowPeerAndGlobal(
          deps.rateLimiter,
          `nostr:${nostrPubkey}`,
          '__global_fallback_forum__',
          MAX_PUBLISH_PER_MINUTE,
          MAX_GLOBAL_FALLBACK_FORUM_PER_MINUTE
        )
      ) {
        return;
      }
      void deps.forumIngest.ingest(event, { source: 'fallback' }).then((ok) => {
        if (ok) deps.fallbackPeers.touch(event.authorUserId);
      });
    },
    onPresence: (userId, state, attestSig, atMs, nostrPubkey) => {
      if (!isValidPresenceState(state)) return;
      if (
        !allowPeerAndGlobal(
          deps.presenceRateLimiter,
          `nostr:${nostrPubkey}`,
          '__global_presence__',
          MAX_PRESENCE_PER_MINUTE,
          MAX_GLOBAL_PRESENCE_PER_MINUTE
        )
      ) {
        return;
      }
      void verifyPresenceAttestation(
        deps.roomId,
        userId,
        state.signPubKeySpkiB64,
        state.encPubKeyRawB64,
        atMs,
        attestSig,
        state.alias,
        state.avatarSeed
      ).then(async (ok) => {
        if (!ok || deps.isLeft()) return;
        if (!deps.presenceKeys.acceptAttestAtMs(userId, atMs)) return;
        await deps.presenceKeys.rememberPresenceKeys(userId, state, 'nostr');
        deps.fallbackPeers.touch(userId);
        deps.options.onPresenceChange(userId, state, false);
      });
    },
    onGoodbye: (
      userId,
      signPubKeySpkiB64,
      encPubKeyRawB64,
      attestSig,
      atMs,
      nostrPubkey
    ) => {
      if (
        !allowPeerAndGlobal(
          deps.presenceRateLimiter,
          `nostr:${nostrPubkey}`,
          '__global_presence__',
          MAX_PRESENCE_PER_MINUTE,
          MAX_GLOBAL_PRESENCE_PER_MINUTE
        )
      ) {
        return;
      }
      void verifyGoodbyeAttestation(
        deps.roomId,
        userId,
        signPubKeySpkiB64,
        encPubKeyRawB64,
        atMs,
        attestSig
      ).then((ok) => {
        if (!ok || deps.isLeft()) return;
        if (!deps.presenceKeys.acceptAttestAtMs(userId, atMs)) return;
        const pinned = deps.trustStore.get(userId)?.pinnedKeyB64;
        if (!pinned || pinned !== signPubKeySpkiB64) return;
        deps.presenceKeys.clearEnc(userId);
        deps.fallbackPeers.drop(userId);
      });
    },
    onDirectMessage: (dm, nostrPubkey) => {
      if (
        !allowPeerAndGlobal(
          deps.dmRateLimiter,
          `nostr:${nostrPubkey}`,
          '__global_fallback_dm__',
          MAX_DM_PER_MINUTE,
          MAX_GLOBAL_DM_PER_MINUTE
        )
      ) {
        return;
      }
      void deps.dmIngest.accept(dm, null).then((ok) => {
        if (ok) deps.fallbackPeers.touch(dm.fromUserId);
      });
    },
    onSyncRequest: async (fromUserId, reqId, nostrPubkey) => {
      if (!deps.syncVerify.allowSyncAnswer(`nostr:${nostrPubkey}`)) {
        return null;
      }
      return deps.syncVerify.buildSignedSyncPayload(fromUserId, reqId);
    },
    onSyncResponse: (reqId, fromUserId, events, eventsDigest, sig, nostrPubkey) => {
      // Bound inbound sync-res amp (same budget as answering sync-req).
      if (!deps.syncVerify.allowSyncAnswer(`nostr-res:${nostrPubkey}`)) {
        return;
      }
      deps.syncVerify.applyNostrSyncResponse(
        reqId,
        fromUserId,
        events,
        eventsDigest,
        sig
      );
    },
  };
}
