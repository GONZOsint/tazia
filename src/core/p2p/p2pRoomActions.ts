import type { Room, Unsubscribe } from 'trystero';
import {
  signDirectMessage,
  signForumEvent,
  wipeSigningIdentity,
  type SigningIdentity,
} from '../crypto/messageSigning';
import {
  sealDmBody,
  wipeEncryptionIdentity,
  type EncryptionIdentity,
} from '../crypto/dmCrypto';
import {
  MAX_DM_BODY_CHARS,
  MAX_DM_PER_MINUTE,
  MAX_PUBLISH_PER_MINUTE,
  PROTOCOL_VERSION,
  isForumEventWithinWireBudget,
  isValidForumEvent,
  isValidPresenceState,
  type DirectMessage,
  type ForumEvent,
  type PresenceState,
} from '../protocol';
import { isValidAvatarSeed } from '../avatar/avatarSeed';
import { buildPresenceState, normalizePresenceAlias } from './p2pPresenceState';
import type { P2pOnlineCoordinator } from './p2pOnline';
import type { P2pSessionBag } from './p2pSubsystems';
import { P2pActionError, type JoinP2pRoomOptions, type JoinedP2pRoom } from './p2pTypes';
import { sampleSyncTargets } from './syncCoordinator';
import { WEBRTC_SYNC_REQ_ID, type ForumSyncResponse } from './syncVerify';
import type { FallbackBridge } from './fallbackBridge';
import type { DmIngest } from './dmIngest';
import type { ForumIngest } from './forumIngest';
import type { PeerRateLimiter } from './rateLimit';
import type { SyncVerify } from './syncVerify';
import type { TrustStore } from '../trust/trustStore';
import type { VerifyKeyRegistry } from './verifyKeyRegistry';
import type { TrysteroActions } from './trysteroIngress';

export type P2pRoomActionContext = {
  roomId: string;
  room: Room;
  signing: SigningIdentity;
  encIdentity: EncryptionIdentity;
  options: JoinP2pRoomOptions;
  session: P2pSessionBag;
  online: P2pOnlineCoordinator;
  actions: TrysteroActions;
  unsubs: Unsubscribe[];
  pruneTimer: { current: ReturnType<typeof setInterval> | null };
  trustStore: TrustStore;
  rateLimiter: PeerRateLimiter;
  syncAnswerLimiter: PeerRateLimiter;
  dmRateLimiter: PeerRateLimiter;
  presenceRateLimiter: PeerRateLimiter;
  knownEncPubKeys: Map<string, string>;
  selfRef: { userId: string };
  registry: VerifyKeyRegistry;
  forumIngest: ForumIngest;
  dmIngest: DmIngest;
  syncVerify: SyncVerify;
  fallbackBridge: FallbackBridge;
};

async function runP2pLeave(ctx: P2pRoomActionContext): Promise<void> {
  if (ctx.session.left) return;
  ctx.session.left = true;
  if (ctx.pruneTimer.current) clearInterval(ctx.pruneTimer.current);
  ctx.pruneTimer.current = null;
  ctx.syncVerify.clearPending();
  await ctx.fallbackBridge.shutdownForLeave(ctx.encIdentity.publicKeyRawB64);
  ctx.rateLimiter.clear();
  ctx.syncAnswerLimiter.clear();
  ctx.dmRateLimiter.clear();
  ctx.presenceRateLimiter.clear();
  ctx.trustStore.clear();
  ctx.registry.clear();
  for (const u of ctx.unsubs) {
    try {
      u();
    } catch {
      /* ignore */
    }
  }
  try {
    await ctx.room.leave();
  } catch {
    /* ignore */
  }
  wipeSigningIdentity(ctx.signing);
  wipeEncryptionIdentity(ctx.encIdentity);
}

export function buildJoinedP2pRoomActions(
  ctx: P2pRoomActionContext
): Omit<JoinedP2pRoom, 'selfUserId' | 'signPubKeySpkiB64' | 'trustStore'> {
  const { actions, session, selfRef } = ctx;

  return {
    leave: () => runP2pLeave(ctx),
    setPresenceAlias: async (alias: string) => {
      const normalized = normalizePresenceAlias(alias);
      if (!normalized) {
        throw new P2pActionError('unknown', 'Invalid presence alias');
      }
      const seed = session.lastPresence?.avatarSeed;
      if (!seed) {
        throw new P2pActionError(
          'unknown',
          'Presence avatarSeed required; call setPresenceProfile first'
        );
      }
      const state = buildPresenceState(normalized, seed, ctx.signing, ctx.encIdentity);
      session.lastPresence = state;
      ctx.knownEncPubKeys.set(selfRef.userId, state.encPubKeyRawB64);
      await actions.presence.set(state);
      ctx.options.onPresenceChange(selfRef.userId, state, false);
      await ctx.fallbackBridge.publishPresence(state);
    },
    setPresenceProfile: async (alias: string, avatarSeed: string) => {
      const normalized = normalizePresenceAlias(alias);
      if (!normalized) {
        throw new P2pActionError('unknown', 'Invalid presence alias');
      }
      if (!isValidAvatarSeed(avatarSeed)) {
        throw new P2pActionError('unknown', 'Invalid presence avatarSeed');
      }
      const state = buildPresenceState(normalized, avatarSeed, ctx.signing, ctx.encIdentity);
      session.lastPresence = state;
      ctx.knownEncPubKeys.set(selfRef.userId, state.encPubKeyRawB64);
      await actions.presence.set(state);
      ctx.options.onPresenceChange(selfRef.userId, state, false);
      await ctx.fallbackBridge.publishPresence(state);
    },
    publishEvent: async (partial) => {
      if (session.left) throw new P2pActionError('unknown', 'P2P session already closed');
      if (!ctx.rateLimiter.allow(selfRef.userId, MAX_PUBLISH_PER_MINUTE)) {
        throw new P2pActionError('publish-rate', 'Local publish rate limit');
      }

      const unsigned: Omit<ForumEvent, 'sig'> = {
        protocolVersion: PROTOCOL_VERSION,
        msgId: partial.msgId,
        type: partial.type,
        threadId: partial.threadId,
        parentMsgId: partial.parentMsgId,
        title: partial.title,
        body: partial.body,
        createdAtMs: partial.createdAtMs,
        authorUserId: selfRef.userId,
      };

      const signed = await signForumEvent(unsigned, ctx.signing);
      if (!isValidForumEvent(signed)) {
        throw new P2pActionError('unknown', 'Signed event failed local validation');
      }
      if (!isForumEventWithinWireBudget(signed)) {
        throw new P2pActionError('wire-too-large', 'Forum event exceeds wire size budget');
      }

      const accepted = await ctx.forumIngest.ingest(signed, {
        liveUserId: selfRef.userId,
        source: 'live',
        skipRateLimit: true,
      });
      if (!accepted) {
        throw new P2pActionError('unknown', 'Signed event rejected by local ingest');
      }

      let delivered = false;
      try {
        await actions.forumMsg.send(signed);
        delivered = true;
      } catch {
        /* try Nostr fallback below */
      }
      if (!delivered) {
        // WebRTC broadcast can reject when any peer's onReceive/channel flakes;
        // retry Nostr a few times (sockets may still be CONNECTING after ensure).
        for (let attempt = 0; attempt < 3 && !delivered; attempt++) {
          delivered = await ctx.fallbackBridge.publishForum(signed, true);
          if (!delivered) {
            await new Promise((r) => window.setTimeout(r, 150 * (attempt + 1)));
          }
        }
        if (delivered && !session.relayFallbackNotified) {
          session.relayFallbackNotified = true;
          ctx.options.onRelayFallback?.();
        }
      } else if (session.relayFallbackNotified) {
        // Best-effort mirror on fallback path when already relay-active.
        void ctx.fallbackBridge.publishForum(signed, false);
      }
      if (!delivered) {
        // Alone in the zone: local ingest is enough; joiners catch up via sync.
        const others = Object.keys(ctx.room.getUsers()).filter((id) => id !== selfRef.userId);
        if (others.length === 0) {
          delivered = true;
        }
      }
      if (!delivered) {
        throw new P2pActionError('unknown', 'Failed to deliver forum event');
      }
    },
    sendDirectMessage: async (toUserId: string, body: string): Promise<DirectMessage> => {
      if (session.left) throw new P2pActionError('unknown', 'P2P session already closed');
      const trimmed = body.slice(0, MAX_DM_BODY_CHARS);
      if (!trimmed.trim()) throw new P2pActionError('unknown', 'Empty DM body');
      if (!ctx.dmRateLimiter.allow(selfRef.userId, MAX_DM_PER_MINUTE)) {
        throw new P2pActionError('publish-rate', 'DM rate limited');
      }

      let peerEnc = ctx.knownEncPubKeys.get(toUserId);
      if (!peerEnc) {
        const live = actions.presence.get(toUserId);
        const pinned = ctx.trustStore.get(toUserId)?.pinnedKeyB64;
        if (
          live &&
          pinned &&
          live.signPubKeySpkiB64 === pinned &&
          isValidPresenceState(live)
        ) {
          peerEnc = ctx.trustStore.getPinnedEnc(toUserId) ?? live.encPubKeyRawB64;
          ctx.knownEncPubKeys.set(toUserId, peerEnc);
        }
      }
      if (!peerEnc) {
        throw new P2pActionError('unknown', 'Peer has no pinned encryption key yet');
      }

      const msgId = crypto.randomUUID();
      const cipher = await sealDmBody({
        plaintext: trimmed,
        selfEnc: ctx.encIdentity,
        peerEncPubB64: peerEnc,
        roomId: ctx.roomId,
        fromUserId: selfRef.userId,
        toUserId,
        msgId,
      });
      if (!cipher) {
        throw new P2pActionError('unknown', 'Failed to seal Susurro');
      }

      const unsigned: Omit<DirectMessage, 'sig'> = {
        protocolVersion: PROTOCOL_VERSION,
        msgId,
        fromUserId: selfRef.userId,
        toUserId,
        body: '',
        bodyCipherB64: cipher,
        seal: 2,
        createdAtMs: Date.now(),
      };

      const signed = await signDirectMessage(unsigned, ctx.signing);
      let delivered = false;
      try {
        await actions.directMsg.send(signed, { target: toUserId });
        delivered = true;
      } catch {
        /* try Nostr fallback below */
      }
      if (!delivered) {
        delivered = await ctx.fallbackBridge.publishDm(signed, true);
      } else if (session.relayFallbackNotified) {
        // Best-effort mirror on fallback path when already relay-active.
        void ctx.fallbackBridge.publishDm(signed, false);
      }
      if (!delivered) {
        throw new P2pActionError('unknown', 'Failed to deliver Susurro');
      }
      ctx.dmIngest.markSeenLocal(signed.msgId);
      return {
        ...signed,
        body: trimmed,
      };
    },
    nudgeTransport: async () => {
      if (session.left) return;
      await ctx.fallbackBridge.ensure();
      if (session.lastPresence && isValidPresenceState(session.lastPresence)) {
        try {
          await actions.presence.set(session.lastPresence);
        } catch {
          /* room may be mid-ICE */
        }
        await ctx.fallbackBridge.publishPresence(session.lastPresence);
      }
      try {
        await ctx.fallbackBridge.requestNostrSync();
      } catch {
        /* ignore */
      }
    },
    requestSyncFromPeers: async () => {
      if (session.left) return 0;
      const allTargets = Object.keys(ctx.room.getUsers()).filter((id) => id !== selfRef.userId);
      const targets = sampleSyncTargets(allTargets);
      let added = 0;

      if (targets.length > 0) {
        try {
          const results = await actions.forumSync.requestMany(
            { want: 'snapshot' },
            { targets, timeoutMs: 8000 }
          );
          for (const res of results) {
            if (res.status !== 'fulfilled' || !res.value || typeof res.value !== 'object') {
              continue;
            }
            const payload = res.value as ForumSyncResponse;
            added += await ctx.syncVerify.verifyAndIngestSyncPayload({
              events: payload.events,
              eventsDigest: payload.eventsDigest,
              sig: payload.sig,
              fromUserId: payload.fromUserId,
              reqId: WEBRTC_SYNC_REQ_ID,
              transportUserId: res.userId,
            });
          }
        } catch {
          // Flaky mesh / empty peer sync — do not surface as a persistent Plaza roomError.
        }
      }

      if (
        ctx.fallbackBridge.getBus() ||
        session.relayFallbackNotified ||
        targets.length === 0
      ) {
        added += await ctx.fallbackBridge.requestNostrSync();
      }

      return added;
    },
    getPresenceMap: () => {
      const all = actions.presence.getAll();
      const out: Record<string, PresenceState> = {};
      for (const [id, state] of Object.entries(all)) {
        if (state && isValidPresenceState(state)) out[id] = state;
      }
      return out;
    },
    getOnlineUserIds: () => ctx.online.readOnlineUserIds(),
    getRejectedSyncCount: () => ctx.syncVerify.getRejectedSyncCount(),
    getForumSnapshot: () => ctx.forumIngest.getForumSnapshot(),
    getDmSnapshot: () => ctx.dmIngest.getDmSnapshot(),
    invalidatePeerKey: async (userId: string) => {
      const enc = ctx.trustStore.getPinnedEnc(userId);
      if (enc) ctx.knownEncPubKeys.set(userId, enc);
      else ctx.knownEncPubKeys.delete(userId);
      await ctx.registry.invalidateAndReload(userId);
      await ctx.dmIngest.flushPendingForUser(userId);
    },
  };
}
