import { joinRoom, type Room, type Unsubscribe } from 'trystero';
import {
  digestSyncEvents,
  generateSigningIdentity,
  signDirectMessage,
  signForumEvent,
  signSyncRes,
  verifySyncRes,
  wipeSigningIdentity,
  type SigningIdentity,
} from '../crypto/messageSigning';
import {
  generateEncryptionIdentity,
  sealDmBody,
  wipeEncryptionIdentity,
  type EncryptionIdentity,
} from '../crypto/dmCrypto';
import {
  APP_ID,
  MAX_DM_BODY_CHARS,
  MAX_DM_CIPHER_B64_CHARS,
  MAX_DM_PER_MINUTE,
  MAX_PRESENCE_STATE_BYTES,
  MAX_PUBLISH_PER_MINUTE,
  MAX_RECEIVE_BYTES,
  MAX_SYNC_ANSWERS_PER_MINUTE,
  MAX_USERS,
  PROTOCOL_VERSION,
  isValidForumEvent,
  isValidPresenceState,
  type DirectMessage,
  type ForumEvent,
  type PresenceState,
} from '../protocol';
import { PeerRateLimiter } from './rateLimit';
import { startNostrFallback, type NostrFallbackBus } from './nostrFallback';
import {
  signGoodbyeAttestation,
  signPresenceAttestation,
  verifyGoodbyeAttestation,
  verifyPresenceAttestation,
} from '../crypto/presenceAttest';
import { TrustStore } from '../trust/trustStore';
import {
  P2pActionError,
  type JoinP2pRoomOptions,
  type JoinedP2pRoom,
} from './p2pTypes';
import { VerifyKeyRegistry } from './verifyKeyRegistry';
import { ForumIngest } from './forumIngest';
import { DmIngest } from './dmIngest';
import {
  clampSyncEvents,
  sampleSyncTargets,
  snapshotForSync,
  syncPayloadTooLarge,
} from './syncCoordinator';

export type { JoinedP2pRoom, JoinP2pRoomOptions, P2pRoomErrorCode } from './p2pTypes';
export { P2pActionError } from './p2pTypes';

const FALLBACK_PEER_TTL_MS = 45_000;
const NOSTR_SYNC_TIMEOUT_MS = 8_000;
/** Soft global budget for Nostr-layer sync answers (anti ID-rotation amp). */
const MAX_GLOBAL_SYNC_ANSWERS_PER_MINUTE = MAX_SYNC_ANSWERS_PER_MINUTE * 3;
const MAX_GLOBAL_DM_PER_MINUTE = MAX_DM_PER_MINUTE * 3;
const MAX_GLOBAL_FALLBACK_FORUM_PER_MINUTE = MAX_PUBLISH_PER_MINUTE * 3;
const MAX_PRESENCE_PER_MINUTE = 20;
const MAX_GLOBAL_PRESENCE_PER_MINUTE = MAX_PRESENCE_PER_MINUTE * 3;

interface ForumSyncResponse {
  events: ForumEvent[];
  fromUserId: string;
  eventsDigest: string;
  sig: string;
}

function emptyPresence(): PresenceState {
  return { alias: '', signPubKeySpkiB64: '', encPubKeyRawB64: '' };
}

export async function joinP2pRoom(options: JoinP2pRoomOptions): Promise<JoinedP2pRoom> {
  const roomId = options.roomId.trim();
  const password = options.password.trim();

  const signing: SigningIdentity = await generateSigningIdentity();
  const encIdentity: EncryptionIdentity | null = await generateEncryptionIdentity();
  if (!encIdentity) {
    wipeSigningIdentity(signing);
    throw new P2pActionError('unknown', 'X25519 required for TAZEP Susurros');
  }

  const trustStore = new TrustStore();
  const rateLimiter = new PeerRateLimiter();
  const syncAnswerLimiter = new PeerRateLimiter();
  const dmRateLimiter = new PeerRateLimiter();
  const presenceRateLimiter = new PeerRateLimiter();
  const localMessages = new Map<string, ForumEvent>();
  const knownEncPubKeys = new Map<string, string>();
  /** userIds first observed via WebRTC presence — preferred over Nostr for pin authority. */
  const webrtcPinned = new Set<string>();
  /** Last accepted presence/goodbye atMs per userId (monotonic). */
  const lastAttestAtMs = new Map<string, number>();
  const selfRef = { userId: '' };
  const unsubs: Unsubscribe[] = [];
  const fallbackPeers = new Map<string, number>();
  const pendingSync = new Map<
    string,
    { resolve: (n: number) => void; added: number; timer: number }
  >();

  let fallback: NostrFallbackBus | null = null;
  let fallbackStarting: Promise<void> | null = null;
  let fallbackPresenceTimer: ReturnType<typeof setTimeout> | null = null;
  let rejectedSyncCount = 0;
  let left = false;
  let pruneTimer: ReturnType<typeof setInterval> | null = null;
  let relayFallbackNotified = false;
  let lastPresence: PresenceState | null = null;
  let room!: Room;

  const registry = new VerifyKeyRegistry({
    trustStore,
    onKeyChange: options.onKeyChange,
    // Forum only: DM flush waits until knownEncPubKeys is synced (rememberPresenceKeys / invalidatePeerKey).
    onKeysReady: (userId) => {
      void forumIngest.flushPendingForUser(userId);
    },
  });

  const forumIngest = new ForumIngest({
    rateLimiter,
    registry,
    localMessages,
    onForumMessage: options.onForumMessage,
    onRejectedSync: () => {
      rejectedSyncCount += 1;
    },
  });

  const dmIngest = new DmIngest({
    roomId,
    self: selfRef,
    encIdentity,
    knownEncPubKeys,
    registry,
    onDirectMessage: options.onDirectMessage,
  });

  const buildPresenceState = (alias: string): PresenceState => ({
    alias: alias.slice(0, 40),
    signPubKeySpkiB64: signing.publicKeySpkiB64,
    encPubKeyRawB64: encIdentity.publicKeyRawB64,
  });

  pruneTimer = setInterval(() => {
    rateLimiter.pruneStale();
    syncAnswerLimiter.pruneStale();
    dmRateLimiter.pruneStale();
    presenceRateLimiter.pruneStale();
  }, 5 * 60_000);

  const mergeOnline = () => {
    const ids = new Set([...Object.keys(room.getUsers()), ...fallbackPeers.keys()]);
    options.onPeerPresence([...ids]);
  };

  /**
   * Pin sign+enc via TOFU. Enc map only updates when observed SPKI matches the pin
   * (never on `changed`). WebRTC presence wins over conflicting Nostr for initial pin.
   */
  const rememberPresenceKeys = async (
    userId: string,
    state: PresenceState,
    source: 'webrtc' | 'nostr'
  ): Promise<void> => {
    if (source === 'nostr' && webrtcPinned.has(userId)) {
      const pinned = trustStore.get(userId)?.pinnedKeyB64;
      if (pinned && pinned !== state.signPubKeySpkiB64) {
        // Surface key-change alert; do not redirect Susurro enc to attacker.
        await registry.observe(userId, state.signPubKeySpkiB64, state.encPubKeyRawB64);
        return;
      }
    }

    await registry.observe(userId, state.signPubKeySpkiB64, state.encPubKeyRawB64);
    if (source === 'webrtc') webrtcPinned.add(userId);

    const rec = trustStore.get(userId);
    if (!rec || rec.pinnedKeyB64 !== state.signPubKeySpkiB64) {
      // `changed`: keep prior pinned enc in knownEncPubKeys (if any).
      return;
    }

    const pinnedEnc = rec.pinnedEncRawB64 ?? state.encPubKeyRawB64;
    const prev = knownEncPubKeys.get(userId);
    knownEncPubKeys.set(userId, pinnedEnc);
    if (prev !== pinnedEnc) {
      void dmIngest.flushPendingForUser(userId);
    }
  };

  const acceptAttestAtMs = (userId: string, atMs: number): boolean => {
    const prev = lastAttestAtMs.get(userId);
    if (prev !== undefined && atMs <= prev) return false;
    lastAttestAtMs.set(userId, atMs);
    return true;
  };

  const touchFallbackPeer = (userId: string) => {
    if (userId === selfRef.userId) return;
    fallbackPeers.set(userId, Date.now());
    mergeOnline();
  };

  const dropFallbackPeer = (userId: string) => {
    if (!fallbackPeers.has(userId)) return;
    fallbackPeers.delete(userId);
    options.onPresenceChange(userId, null, true);
    mergeOnline();
  };

  try {
    const rtcConfig: RTCConfiguration = {
      iceCandidatePoolSize: 8,
      iceTransportPolicy: options.relayOnly ? 'relay' : 'all',
      ...options.rtcConfig,
      ...(options.relayOnly ? { iceTransportPolicy: 'relay' as const } : {}),
    };
    room = joinRoom(
      {
        appId: APP_ID,
        password,
        identity: 'none',
        maxUsers: MAX_USERS,
        maxReceiveBytes: MAX_RECEIVE_BYTES,
        trickleIce: true,
        rtcConfig,
        ...(options.turnConfig?.length ? { turnConfig: options.turnConfig } : {}),
      },
      roomId
    );
  } catch (err) {
    wipeSigningIdentity(signing);
    wipeEncryptionIdentity(encIdentity);
    throw new P2pActionError(
      'unknown',
      err instanceof Error ? err.message : 'Failed to open Trystero room'
    );
  }

  await room.ready;
  const self = await room.getSelf();
  selfRef.userId = self.userId;
  knownEncPubKeys.set(self.userId, encIdentity.publicKeyRawB64);
  await registry.observe(self.userId, signing.publicKeySpkiB64, encIdentity.publicKeyRawB64);
  webrtcPinned.add(self.userId);

  const forumMsg = room.makeAction<ForumEvent>('forumMsg');
  const directMsg = room.makeAction<DirectMessage>('directMsg');
  const forumSync = room.makeAction<{ want: string }, ForumSyncResponse>('forumSync', {
    kind: 'request',
  });
  // Reject oversized inbound actions before JSON parse / ingest (Trystero onReceive).
  const maxForumWire = 24_000;
  const maxDmWire = MAX_DM_CIPHER_B64_CHARS + 2_048;
  unsubs.push(
    forumMsg.onReceive(({ byteLength }) => byteLength <= maxForumWire),
    directMsg.onReceive(({ byteLength }) => byteLength <= maxDmWire),
    forumSync.onReceive(({ byteLength }) => byteLength <= MAX_RECEIVE_BYTES)
  );
  const presence = room.makeUserState<PresenceState>('presence', emptyPresence(), {
    maxBytes: MAX_PRESENCE_STATE_BYTES,
    validate: (next) => {
      if (!next || typeof next !== 'object') return false;
      const alias = (next as PresenceState).alias;
      if (alias === '') return true;
      return isValidPresenceState(next);
    },
  });

  const publishPresenceFallback = async (state: PresenceState) => {
    if (!fallback || left) return;
    const atMs = Date.now();
    const attestSig = await signPresenceAttestation(
      signing,
      roomId,
      selfRef.userId,
      state.signPubKeySpkiB64,
      state.encPubKeyRawB64,
      atMs,
      state.alias
    );
    await fallback.publish({
      v: 2,
      t: 'presence',
      userId: selfRef.userId,
      state,
      atMs,
      attestSig,
    });
  };

  const buildSignedSyncResponse = async (toUserId: string): Promise<ForumSyncResponse> => {
    const events = snapshotForSync(localMessages);
    const eventsDigest = await digestSyncEvents(events);
    const sig = await signSyncRes(
      signing,
      roomId,
      'webrtc-sync',
      selfRef.userId,
      toUserId,
      eventsDigest
    );
    return {
      events,
      fromUserId: selfRef.userId,
      eventsDigest,
      sig,
    };
  };

  const ensureFallback = async (): Promise<NostrFallbackBus | null> => {
    if (left) return null;
    if (fallback) return fallback;
    if (fallbackStarting) {
      await fallbackStarting;
      return fallback;
    }
    fallbackStarting = (async () => {
      try {
        fallback = await startNostrFallback(roomId, password, selfRef.userId, {
          onForum: (event, nostrPubkey) => {
            if (!rateLimiter.allow(`nostr:${nostrPubkey}`, MAX_PUBLISH_PER_MINUTE)) return;
            if (!rateLimiter.allow('__global_fallback_forum__', MAX_GLOBAL_FALLBACK_FORUM_PER_MINUTE)) {
              return;
            }
            // No fake Trystero liveUserId — signature + attested registry only.
            void forumIngest.ingest(event, { source: 'fallback' }).then((ok) => {
              if (ok) touchFallbackPeer(event.authorUserId);
            });
          },
          onPresence: (userId, state, attestSig, atMs, nostrPubkey) => {
            if (!isValidPresenceState(state)) return;
            if (!presenceRateLimiter.allow(`nostr:${nostrPubkey}`, MAX_PRESENCE_PER_MINUTE)) {
              return;
            }
            if (
              !presenceRateLimiter.allow('__global_presence__', MAX_GLOBAL_PRESENCE_PER_MINUTE)
            ) {
              return;
            }
            void verifyPresenceAttestation(
              roomId,
              userId,
              state.signPubKeySpkiB64,
              state.encPubKeyRawB64,
              atMs,
              attestSig,
              state.alias
            ).then(async (ok) => {
              if (!ok || left) return;
              if (!acceptAttestAtMs(userId, atMs)) return;
              await rememberPresenceKeys(userId, state, 'nostr');
              touchFallbackPeer(userId);
              options.onPresenceChange(userId, state, false);
            });
          },
          onGoodbye: (userId, signPubKeySpkiB64, encPubKeyRawB64, attestSig, atMs, nostrPubkey) => {
            if (!presenceRateLimiter.allow(`nostr:${nostrPubkey}`, MAX_PRESENCE_PER_MINUTE)) {
              return;
            }
            if (
              !presenceRateLimiter.allow('__global_presence__', MAX_GLOBAL_PRESENCE_PER_MINUTE)
            ) {
              return;
            }
            void verifyGoodbyeAttestation(
              roomId,
              userId,
              signPubKeySpkiB64,
              encPubKeyRawB64,
              atMs,
              attestSig
            ).then((ok) => {
              if (!ok || left) return;
              if (!acceptAttestAtMs(userId, atMs)) return;
              const pinned = trustStore.get(userId)?.pinnedKeyB64;
              if (!pinned || pinned !== signPubKeySpkiB64) return;
              knownEncPubKeys.delete(userId);
              dropFallbackPeer(userId);
            });
          },
          onDirectMessage: (dm, nostrPubkey) => {
            // Rate-limit by Nostr pubkey (not spoofable claimed fromUserId).
            if (!dmRateLimiter.allow(`nostr:${nostrPubkey}`, MAX_DM_PER_MINUTE)) return;
            if (!dmRateLimiter.allow('__global_fallback_dm__', MAX_GLOBAL_DM_PER_MINUTE)) return;
            void dmIngest.accept(dm, null).then((ok) => {
              if (ok) touchFallbackPeer(dm.fromUserId);
            });
          },
          onSyncRequest: async (fromUserId, reqId, nostrPubkey) => {
            if (!syncAnswerLimiter.allow(`nostr:${nostrPubkey}`, MAX_SYNC_ANSWERS_PER_MINUTE)) {
              return null;
            }
            if (
              !syncAnswerLimiter.allow('__global_sync__', MAX_GLOBAL_SYNC_ANSWERS_PER_MINUTE)
            ) {
              return null;
            }
            const events = snapshotForSync(localMessages);
            const eventsDigest = await digestSyncEvents(events);
            const sig = await signSyncRes(
              signing,
              roomId,
              reqId,
              selfRef.userId,
              fromUserId,
              eventsDigest
            );
            return {
              events,
              fromUserId: selfRef.userId,
              eventsDigest,
              sig,
            };
          },
          onSyncResponse: (reqId, fromUserId, events, eventsDigest, sig) => {
            void (async () => {
              const pending = pendingSync.get(reqId);
              if (!pending) return;

              const rejectSoft = () => {
                rejectedSyncCount += 1;
                // Keep pending open until timeout or a valid signed response.
              };

              if (syncPayloadTooLarge(events)) {
                rejectSoft();
                return;
              }
              const clamped = clampSyncEvents(events);
              const digest = await digestSyncEvents(clamped);
              if (digest !== eventsDigest) {
                rejectSoft();
                return;
              }
              const verifyKey = await registry.get(fromUserId);
              if (!verifyKey) {
                rejectSoft();
                return;
              }
              const okSig = await verifySyncRes(
                verifyKey,
                roomId,
                reqId,
                fromUserId,
                selfRef.userId,
                eventsDigest,
                sig
              );
              if (!okSig) {
                rejectSoft();
                return;
              }
              let added = 0;
              for (const item of clamped) {
                const ok = await forumIngest.ingest(item, { liveUserId: null, source: 'sync' });
                if (ok) added += 1;
              }
              const still = pendingSync.get(reqId);
              if (!still) return;
              // Merge all valid replies until timeout (no early resolve / empty-first censorship).
              still.added += added;
            })();
          },
        });

        if (!fallbackPresenceTimer) {
          const schedulePresenceBeat = () => {
            const delay = 12_000 + Math.floor(Math.random() * 4_000);
            fallbackPresenceTimer = setTimeout(() => {
              if (left || !fallback) return;
              const now = Date.now();
              let pruned = false;
              for (const [id, at] of fallbackPeers) {
                if (now - at > FALLBACK_PEER_TTL_MS) {
                  fallbackPeers.delete(id);
                  options.onPresenceChange(id, null, true);
                  pruned = true;
                }
              }
              if (pruned) mergeOnline();
              if (lastPresence && isValidPresenceState(lastPresence)) {
                void publishPresenceFallback(lastPresence);
              }
              schedulePresenceBeat();
            }, delay);
          };
          schedulePresenceBeat();
        }

        if (lastPresence && isValidPresenceState(lastPresence)) {
          await publishPresenceFallback(lastPresence);
        }
      } catch {
        fallback = null;
        options.onError('unknown', 'Nostr fallback failed to start');
      } finally {
        fallbackStarting = null;
      }
    })();
    await fallbackStarting;
    return fallback;
  };

  const requestNostrSync = async (): Promise<number> => {
    const bus = await ensureFallback();
    if (!bus) return 0;
    const reqId = crypto.randomUUID();
    return new Promise<number>((resolve) => {
      const timer = window.setTimeout(() => {
        const p = pendingSync.get(reqId);
        pendingSync.delete(reqId);
        resolve(p?.added ?? 0);
      }, NOSTR_SYNC_TIMEOUT_MS);
      pendingSync.set(reqId, { resolve, added: 0, timer });
      void bus
        .publish({ v: 2, t: 'sync-req', fromUserId: selfRef.userId, reqId })
        .catch(() => {
          window.clearTimeout(timer);
          const p = pendingSync.get(reqId);
          pendingSync.delete(reqId);
          resolve(p?.added ?? 0);
        });
    });
  };

  unsubs.push(
    forumMsg.onMessage((data, { userId }) => {
      if (left) return;
      void forumIngest.ingest(data, { liveUserId: userId, source: 'live' });
    })
  );

  unsubs.push(
    directMsg.onMessage((data, { userId }) => {
      if (left) return;
      if (!dmRateLimiter.allow(userId, MAX_DM_PER_MINUTE)) return;
      void dmIngest.accept(data, userId);
    })
  );

  unsubs.push(
    forumSync.onRequest((_data, context) => {
      if (!syncAnswerLimiter.allow(context.userId, MAX_SYNC_ANSWERS_PER_MINUTE)) {
        return {
          events: [],
          fromUserId: selfRef.userId,
          eventsDigest: '',
          sig: '',
        };
      }
      return buildSignedSyncResponse(context.userId);
    })
  );

  unsubs.push(
    presence.onChange(
      (value, { userId, removed }) => {
        if (left) return;
        if (removed) {
          fallbackPeers.delete(userId);
          options.onPresenceChange(userId, null, true);
          mergeOnline();
          return;
        }
        if (!value || !isValidPresenceState(value)) return;
        void rememberPresenceKeys(userId, value, 'webrtc').then(() => {
          if (left) return;
          options.onPresenceChange(userId, value, false);
          touchFallbackPeer(userId);
        });
      },
      { replay: true }
    )
  );

  unsubs.push(
    room.onUserJoin(({ userId }) => {
      if (left) return;
      mergeOnline();
      options.onUserJoined?.(userId);
    }, { replay: true })
  );

  unsubs.push(
    room.onUserLeave(({ userId }) => {
      if (left) return;
      fallbackPeers.delete(userId);
      options.onPresenceChange(userId, null, true);
      mergeOnline();
    })
  );

  unsubs.push(
    room.onError((err) => {
      if (left) return;
      if (err.code === 'peer-connect-failed') {
        void (async () => {
          await ensureFallback();
          if (!relayFallbackNotified) {
            relayFallbackNotified = true;
            options.onRelayFallback?.();
          }
        })();
        return;
      }
      options.onError(err.code, err.message);
    })
  );

  mergeOnline();

  return {
    selfUserId: self.userId,
    signPubKeySpkiB64: signing.publicKeySpkiB64,
    trustStore,
    leave: async () => {
      if (left) return;
      left = true;
      if (pruneTimer) clearInterval(pruneTimer);
      if (fallbackPresenceTimer) clearTimeout(fallbackPresenceTimer);
      fallbackPresenceTimer = null;
      for (const pending of pendingSync.values()) {
        window.clearTimeout(pending.timer);
        pending.resolve(pending.added);
      }
      pendingSync.clear();
      if (fallback) {
        try {
          const atMs = Date.now();
          const goodbyeSig = await signGoodbyeAttestation(
            signing,
            roomId,
            selfRef.userId,
            signing.publicKeySpkiB64,
            encIdentity.publicKeyRawB64,
            atMs
          );
          await fallback.publish({
            v: 2,
            t: 'goodbye',
            userId: selfRef.userId,
            atMs,
            signPubKeySpkiB64: signing.publicKeySpkiB64,
            encPubKeyRawB64: encIdentity.publicKeyRawB64,
            attestSig: goodbyeSig,
          });
        } catch {
          /* ignore */
        }
        fallback.stop();
        fallback = null;
      }
      rateLimiter.clear();
      syncAnswerLimiter.clear();
      dmRateLimiter.clear();
      presenceRateLimiter.clear();
      trustStore.clear();
      registry.clear();
      for (const u of unsubs) {
        try {
          u();
        } catch {
          /* ignore */
        }
      }
      try {
        await room.leave();
      } catch {
        /* ignore */
      }
      wipeSigningIdentity(signing);
      wipeEncryptionIdentity(encIdentity);
    },
    setPresenceAlias: async (alias: string) => {
      const state = buildPresenceState(alias);
      lastPresence = state;
      knownEncPubKeys.set(selfRef.userId, state.encPubKeyRawB64);
      await presence.set(state);
      options.onPresenceChange(selfRef.userId, state, false);
      await publishPresenceFallback(state);
    },
    publishEvent: async (partial) => {
      if (left) throw new P2pActionError('unknown', 'P2P session already closed');
      if (!rateLimiter.allow(selfRef.userId, MAX_PUBLISH_PER_MINUTE)) {
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

      const signed = await signForumEvent(unsigned, signing);
      if (!isValidForumEvent(signed)) {
        throw new P2pActionError('unknown', 'Signed event failed local validation');
      }

      localMessages.set(signed.msgId, signed);
      options.onForumMessage(signed);
      try {
        await forumMsg.send(signed);
      } catch {
        /* WebRTC may be down */
      }
      if (fallback) {
        await fallback.publish({ v: 2, t: 'forum', event: signed });
      } else if (relayFallbackNotified) {
        const bus = await ensureFallback();
        await bus?.publish({ v: 2, t: 'forum', event: signed });
      }
    },
    sendDirectMessage: async (toUserId: string, body: string): Promise<DirectMessage> => {
      if (left) throw new P2pActionError('unknown', 'P2P session already closed');
      const trimmed = body.slice(0, MAX_DM_BODY_CHARS);
      if (!trimmed.trim()) throw new P2pActionError('unknown', 'Empty DM body');
      if (!dmRateLimiter.allow(selfRef.userId, MAX_DM_PER_MINUTE)) {
        throw new P2pActionError('publish-rate', 'DM rate limited');
      }

      // Only seal to TOFU-pinned enc (never unpinned presence overwrites).
      let peerEnc = knownEncPubKeys.get(toUserId);
      if (!peerEnc) {
        const live = presence.get(toUserId);
        const pinned = trustStore.get(toUserId)?.pinnedKeyB64;
        if (
          live &&
          pinned &&
          live.signPubKeySpkiB64 === pinned &&
          isValidPresenceState(live)
        ) {
          peerEnc = trustStore.getPinnedEnc(toUserId) ?? live.encPubKeyRawB64;
          knownEncPubKeys.set(toUserId, peerEnc);
        }
      }
      if (!peerEnc) {
        throw new P2pActionError('unknown', 'Peer has no pinned encryption key yet');
      }

      const msgId = crypto.randomUUID();
      const cipher = await sealDmBody({
        plaintext: trimmed,
        selfEnc: encIdentity,
        peerEncPubB64: peerEnc,
        roomId,
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

      const signed = await signDirectMessage(unsigned, signing);
      dmIngest.markSeenLocal(signed.msgId);
      try {
        await directMsg.send(signed, { target: toUserId });
      } catch {
        /* fallback */
      }
      if (fallback || relayFallbackNotified) {
        const bus = fallback ?? (await ensureFallback());
        await bus?.publish({ v: 2, t: 'dm', dm: signed });
      }
      return {
        ...signed,
        body: trimmed,
      };
    },
    nudgeTransport: async () => {
      if (left) return;
      await ensureFallback();
      if (lastPresence && isValidPresenceState(lastPresence)) {
        try {
          await presence.set(lastPresence);
        } catch {
          /* room may be mid-ICE */
        }
        await publishPresenceFallback(lastPresence);
      }
      try {
        await requestNostrSync();
      } catch {
        /* ignore */
      }
    },
    requestSyncFromPeers: async () => {
      if (left) return 0;
      const allTargets = Object.keys(room.getUsers()).filter((id) => id !== selfRef.userId);
      const targets = sampleSyncTargets(allTargets);
      let added = 0;

      if (targets.length > 0) {
        try {
          const results = await forumSync.requestMany(
            { want: 'snapshot' },
            { targets, timeoutMs: 8000 }
          );
          for (const res of results) {
            if (res.status !== 'fulfilled' || !res.value || typeof res.value !== 'object') {
              continue;
            }
            const payload = res.value as ForumSyncResponse;
            if (!Array.isArray(payload.events) || !payload.fromUserId || !payload.sig) {
              rejectedSyncCount += 1;
              continue;
            }
            if (res.userId !== payload.fromUserId) {
              rejectedSyncCount += 1;
              continue;
            }
            if (syncPayloadTooLarge(payload.events)) {
              rejectedSyncCount += 1;
              continue;
            }
            const clamped = clampSyncEvents(payload.events);
            const digest = await digestSyncEvents(clamped);
            if (digest !== payload.eventsDigest) {
              rejectedSyncCount += 1;
              continue;
            }
            const verifyKey = await registry.get(payload.fromUserId);
            if (!verifyKey) {
              rejectedSyncCount += 1;
              continue;
            }
            const okSig = await verifySyncRes(
              verifyKey,
              roomId,
              'webrtc-sync',
              payload.fromUserId,
              selfRef.userId,
              payload.eventsDigest,
              payload.sig
            );
            if (!okSig) {
              rejectedSyncCount += 1;
              continue;
            }
            for (const item of clamped) {
              const ok = await forumIngest.ingest(item, { liveUserId: null, source: 'sync' });
              if (ok) added += 1;
            }
          }
        } catch (err) {
          options.onError(
            'unknown',
            err instanceof Error ? err.message : 'Peer sync failed'
          );
        }
      }

      if (fallback || relayFallbackNotified || targets.length === 0) {
        added += await requestNostrSync();
      }

      return added;
    },
    getPresenceMap: () => {
      const all = presence.getAll();
      const out: Record<string, PresenceState> = {};
      for (const [id, state] of Object.entries(all)) {
        if (state && isValidPresenceState(state)) out[id] = state;
      }
      return out;
    },
    getOnlineUserIds: () => {
      const ids = new Set([...Object.keys(room.getUsers()), ...fallbackPeers.keys()]);
      return [...ids];
    },
    getRejectedSyncCount: () => rejectedSyncCount,
    invalidatePeerKey: async (userId: string) => {
      const enc = trustStore.getPinnedEnc(userId);
      if (enc) knownEncPubKeys.set(userId, enc);
      else knownEncPubKeys.delete(userId);
      await registry.invalidateAndReload(userId);
      await dmIngest.flushPendingForUser(userId);
    },
  };
}
