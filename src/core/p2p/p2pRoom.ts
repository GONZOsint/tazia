import { joinRoom, type Room, type Unsubscribe } from 'trystero';
import {
  generateSigningIdentity,
  importVerifyKey,
  signDirectMessage,
  signForumEvent,
  verifyDirectMessage,
  verifyForumEvent,
  wipeSigningIdentity,
  type SigningIdentity,
  type VerifyKey,
} from '../crypto/messageSigning';
import {
  generateEncryptionIdentity,
  openDmBody,
  sealDmBody,
  type EncryptionIdentity,
} from '../crypto/dmCrypto';
import {
  APP_ID,
  MAX_DM_BODY_CHARS,
  MAX_PUBLISH_PER_MINUTE,
  MAX_SYNC_ANSWERS_PER_MINUTE,
  MAX_SYNC_MESSAGES,
  MAX_SYNC_TOTAL_BYTES,
  MAX_USERS,
  PROTOCOL_VERSION,
  isValidDirectMessage,
  isValidForumEvent,
  isValidPresenceState,
  type DirectMessage,
  type ForumEvent,
  type PresenceState,
} from '../protocol';
import { PeerRateLimiter } from './rateLimit';
import { startNostrFallback, type NostrFallbackBus } from './nostrFallback';
import { TrustStore } from '../trust/trustStore';
import {
  P2pActionError,
  type JoinP2pRoomOptions,
  type JoinedP2pRoom,
} from './p2pTypes';

export type { JoinedP2pRoom, JoinP2pRoomOptions, P2pRoomErrorCode } from './p2pTypes';
export { P2pActionError } from './p2pTypes';

function emptyPresence(): PresenceState {
  return { alias: '', signPubKeySpkiB64: '' };
}

const PENDING_TTL_MS = 60_000;
const FALLBACK_PEER_TTL_MS = 45_000;
const NOSTR_SYNC_TIMEOUT_MS = 8_000;

export async function joinP2pRoom(options: JoinP2pRoomOptions): Promise<JoinedP2pRoom> {
  const signing: SigningIdentity = await generateSigningIdentity();
  const encIdentity: EncryptionIdentity | null = await generateEncryptionIdentity();
  const verifyKeyCache = new Map<string, VerifyKey>();
  const knownPubKeys = new Map<string, string>();
  const knownEncPubKeys = new Map<string, string>();
  const rateLimiter = new PeerRateLimiter();
  const syncAnswerLimiter = new PeerRateLimiter();
  const localMessages = new Map<string, ForumEvent>();
  /** Reserved while verify is in flight — blocks dual-path double emit. */
  const ingestingIds = new Set<string>();
  const pendingLive = new Map<string, ForumEvent[]>();
  const pendingDms = new Map<string, DirectMessage[]>();
  const trustStore = new TrustStore();
  const unsubs: Unsubscribe[] = [];
  const fallbackPeers = new Map<string, number>();
  const pendingSync = new Map<
    string,
    { resolve: (n: number) => void; added: number; timer: number }
  >();
  let fallback: NostrFallbackBus | null = null;
  let fallbackStarting: Promise<void> | null = null;
  let fallbackPresenceTimer: ReturnType<typeof setInterval> | null = null;
  let rejectedSyncCount = 0;
  let left = false;
  let pruneTimer: ReturnType<typeof setInterval> | null = null;
  let relayFallbackNotified = false;
  let lastPresence: PresenceState | null = null;

  const buildPresenceState = (alias: string): PresenceState => {
    const state: PresenceState = {
      alias: alias.slice(0, 40),
      signPubKeySpkiB64: signing.publicKeySpkiB64,
    };
    if (encIdentity) state.encPubKeyRawB64 = encIdentity.publicKeyRawB64;
    return state;
  };

  pruneTimer = setInterval(() => {
    rateLimiter.pruneStale();
    syncAnswerLimiter.pruneStale();
  }, 5 * 60_000);

  const mergeOnline = () => {
    const ids = new Set([...Object.keys(room.getUsers()), ...fallbackPeers.keys()]);
    options.onPeerPresence([...ids]);
  };

  const cachePubKey = async (userId: string, spkiB64: string): Promise<VerifyKey | null> => {
    if (!userId || !spkiB64 || spkiB64.length < 32) return null;
    knownPubKeys.set(userId, spkiB64);

    const trustLevel = trustStore.observe(userId, spkiB64);
    if (trustLevel === 'changed') {
      options.onKeyChange?.(userId, trustLevel);
    }

    const existing = verifyKeyCache.get(userId);
    if (existing) {
      await flushPendingForUser(userId);
      return existing;
    }
    try {
      const key = await importVerifyKey(spkiB64);
      verifyKeyCache.set(userId, key);
      await flushPendingForUser(userId);
      return key;
    } catch {
      return null;
    }
  };

  const getVerifyKey = async (userId: string): Promise<VerifyKey | null> => {
    const cached = verifyKeyCache.get(userId);
    if (cached) return cached;
    const spki = knownPubKeys.get(userId);
    if (!spki) return null;
    return cachePubKey(userId, spki);
  };

  const queuePendingLive = (event: ForumEvent) => {
    const list = pendingLive.get(event.authorUserId) ?? [];
    if (list.some((e) => e.msgId === event.msgId)) return;
    list.push(event);
    if (list.length > 40) list.shift();
    pendingLive.set(event.authorUserId, list);
    window.setTimeout(() => {
      const cur = pendingLive.get(event.authorUserId);
      if (!cur) return;
      const next = cur.filter((e) => e.msgId !== event.msgId);
      if (next.length) pendingLive.set(event.authorUserId, next);
      else pendingLive.delete(event.authorUserId);
    }, PENDING_TTL_MS);
  };

  const queuePendingDm = (dm: DirectMessage) => {
    const list = pendingDms.get(dm.fromUserId) ?? [];
    if (list.some((d) => d.msgId === dm.msgId)) return;
    list.push(dm);
    if (list.length > 20) list.shift();
    pendingDms.set(dm.fromUserId, list);
  };

  const ingestSigned = async (
    event: ForumEvent,
    opts: { liveUserId: string | null; source: 'live' | 'sync' }
  ): Promise<boolean> => {
    if (!isValidForumEvent(event, { clockSource: opts.source })) {
      if (opts.source === 'sync') rejectedSyncCount += 1;
      return false;
    }

    if (opts.liveUserId) {
      if (event.authorUserId !== opts.liveUserId) return false;
      if (!rateLimiter.allow(opts.liveUserId, MAX_PUBLISH_PER_MINUTE)) {
        return false;
      }
    }

    if (localMessages.has(event.msgId) || ingestingIds.has(event.msgId)) return false;
    ingestingIds.add(event.msgId);

    try {
      const verifyKey = await getVerifyKey(event.authorUserId);
      if (!verifyKey) {
        ingestingIds.delete(event.msgId);
        if (opts.source === 'sync') {
          rejectedSyncCount += 1;
          return false;
        }
        queuePendingLive(event);
        return false;
      }

      const ok = await verifyForumEvent(event, verifyKey);
      if (!ok) {
        if (opts.source === 'sync') rejectedSyncCount += 1;
        return false;
      }

      if (localMessages.has(event.msgId)) return false;
      localMessages.set(event.msgId, event);
      options.onForumMessage(event);
      return true;
    } finally {
      ingestingIds.delete(event.msgId);
    }
  };

  const acceptDm = async (dm: DirectMessage, transportUserId: string | null): Promise<boolean> => {
    if (!isValidDirectMessage(dm)) return false;
    if (transportUserId && dm.fromUserId !== transportUserId) return false;
    if (dm.toUserId !== self.userId) return false;
    const verifyKey = await getVerifyKey(dm.fromUserId);
    if (!verifyKey) {
      queuePendingDm(dm);
      return false;
    }
    const ok = await verifyDirectMessage(dm, verifyKey);
    if (!ok) return false;

    const peerEnc = knownEncPubKeys.get(dm.fromUserId);
    const selfCanSeal = Boolean(encIdentity);
    const peerCanSeal = Boolean(peerEnc);

    if (dm.seal === 2 && dm.bodyCipherB64) {
      if (!encIdentity || !peerEnc) {
        queuePendingDm(dm);
        return false;
      }
      const plain = await openDmBody(dm.bodyCipherB64, encIdentity, peerEnc);
      if (plain === null || !plain.trim()) return false;
      options.onDirectMessage?.({ ...dm, body: plain.slice(0, MAX_DM_BODY_CHARS), bodyCipherB64: undefined, seal: undefined });
      return true;
    }

    // New peers that advertise enc keys reject cleartext Susurros.
    if (selfCanSeal && peerCanSeal && dm.body.length > 0) return false;

    if (!dm.body.trim()) return false;
    options.onDirectMessage?.(dm);
    return true;
  };

  async function flushPendingForUser(userId: string) {
    const events = pendingLive.get(userId);
    if (events?.length) {
      pendingLive.delete(userId);
      for (const ev of events) {
        await ingestSigned(ev, { liveUserId: ev.authorUserId, source: 'live' });
      }
    }
    const dms = pendingDms.get(userId);
    if (dms?.length) {
      pendingDms.delete(userId);
      for (const dm of dms) {
        await acceptDm(dm, null);
      }
    }
  }

  const rememberPresenceKeys = (userId: string, state: PresenceState) => {
    void cachePubKey(userId, state.signPubKeySpkiB64);
    if (state.encPubKeyRawB64) {
      const prev = knownEncPubKeys.get(userId);
      knownEncPubKeys.set(userId, state.encPubKeyRawB64);
      if (prev !== state.encPubKeyRawB64) {
        void flushPendingForUser(userId);
      }
    }
  };

  let room: Room;
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
        password: options.password.trim(),
        identity: 'none',
        maxUsers: MAX_USERS,
        trickleIce: true,
        rtcConfig,
        ...(options.turnConfig?.length ? { turnConfig: options.turnConfig } : {}),
      },
      options.roomId.trim()
    );
  } catch (err) {
    throw new P2pActionError(
      'unknown',
      err instanceof Error ? err.message : 'Failed to open Trystero room'
    );
  }

  await room.ready;
  const self = await room.getSelf();
  knownPubKeys.set(self.userId, signing.publicKeySpkiB64);
  await cachePubKey(self.userId, signing.publicKeySpkiB64);

  const forumMsg = room.makeAction<ForumEvent>('forumMsg');
  const directMsg = room.makeAction<DirectMessage>('directMsg');
  const forumSync = room.makeAction<{ want: string }, ForumEvent[]>('forumSync', {
    kind: 'request',
  });
  const presence = room.makeUserState<PresenceState>('presence', emptyPresence(), {
    validate: (next) => {
      if (!next || typeof next !== 'object') return false;
      const alias = (next as PresenceState).alias;
      if (alias === '') return true;
      return isValidPresenceState(next);
    },
  });

  const touchFallbackPeer = (userId: string) => {
    if (userId === self.userId) return;
    fallbackPeers.set(userId, Date.now());
    mergeOnline();
  };

  const dropFallbackPeer = (userId: string) => {
    if (!fallbackPeers.has(userId)) return;
    fallbackPeers.delete(userId);
    options.onPresenceChange(userId, null, true);
    mergeOnline();
  };

  const snapshotForSync = (): ForumEvent[] => {
    const list = [...localMessages.values()]
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .slice(-MAX_SYNC_MESSAGES);
    const raw = JSON.stringify(list);
    if (new TextEncoder().encode(raw).byteLength > MAX_SYNC_TOTAL_BYTES) {
      return list.slice(-Math.floor(list.length / 2));
    }
    return list;
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
        fallback = await startNostrFallback(
          options.roomId.trim(),
          options.password.trim(),
          self.userId,
          {
            onForum: (event) => {
              void ingestSigned(event, { liveUserId: event.authorUserId, source: 'live' });
              touchFallbackPeer(event.authorUserId);
            },
            onPresence: (userId, state) => {
              if (!isValidPresenceState(state)) return;
              rememberPresenceKeys(userId, state);
              touchFallbackPeer(userId);
              options.onPresenceChange(userId, state, false);
            },
            onGoodbye: (userId) => {
              dropFallbackPeer(userId);
            },
            onDirectMessage: (dm) => {
              void acceptDm(dm, null).then((ok) => {
                if (ok) touchFallbackPeer(dm.fromUserId);
              });
            },
            onSyncRequest: (fromUserId) => {
              if (!syncAnswerLimiter.allow(fromUserId, MAX_SYNC_ANSWERS_PER_MINUTE)) {
                return [];
              }
              return snapshotForSync();
            },
            onSyncResponse: (reqId, events) => {
              void (async () => {
                const pending = pendingSync.get(reqId);
                const raw = JSON.stringify(events);
                if (new TextEncoder().encode(raw).byteLength > MAX_SYNC_TOTAL_BYTES) {
                  rejectedSyncCount += 1;
                  if (pending) {
                    window.clearTimeout(pending.timer);
                    pendingSync.delete(reqId);
                    pending.resolve(pending.added);
                  }
                  return;
                }
                let added = 0;
                for (const item of events.slice(0, MAX_SYNC_MESSAGES)) {
                  const ok = await ingestSigned(item, { liveUserId: null, source: 'sync' });
                  if (ok) added += 1;
                }
                if (pending) {
                  window.clearTimeout(pending.timer);
                  pendingSync.delete(reqId);
                  pending.resolve(pending.added + added);
                }
              })();
            },
          }
        );

        if (!fallbackPresenceTimer) {
          fallbackPresenceTimer = setInterval(() => {
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
              void fallback.publish({
                v: 1,
                t: 'presence',
                userId: self.userId,
                state: lastPresence,
                atMs: Date.now(),
              });
            }
          }, 12_000);
        }

        if (lastPresence && isValidPresenceState(lastPresence)) {
          await fallback.publish({
            v: 1,
            t: 'presence',
            userId: self.userId,
            state: lastPresence,
            atMs: Date.now(),
          });
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

  const publishPresenceFallback = async (state: PresenceState) => {
    if (!fallback || left) return;
    await fallback.publish({
      v: 1,
      t: 'presence',
      userId: self.userId,
      state,
      atMs: Date.now(),
    });
  };

  const requestNostrSync = async (): Promise<number> => {
    const bus = await ensureFallback();
    if (!bus) return 0;
    const reqId = crypto.randomUUID();
    return new Promise<number>((resolve) => {
      const timer = window.setTimeout(() => {
        pendingSync.delete(reqId);
        resolve(0);
      }, NOSTR_SYNC_TIMEOUT_MS);
      pendingSync.set(reqId, { resolve, added: 0, timer });
      void bus.publish({ v: 1, t: 'sync-req', fromUserId: self.userId, reqId }).catch(() => {
        window.clearTimeout(timer);
        pendingSync.delete(reqId);
        resolve(0);
      });
    });
  };

  unsubs.push(
    forumMsg.onMessage((data, { userId }) => {
      if (left) return;
      void ingestSigned(data, { liveUserId: userId, source: 'live' });
    })
  );

  unsubs.push(
    directMsg.onMessage((data, { userId }) => {
      if (left) return;
      void acceptDm(data, userId);
    })
  );

  unsubs.push(
    forumSync.onRequest((_data, context) => {
      if (!syncAnswerLimiter.allow(context.userId, MAX_SYNC_ANSWERS_PER_MINUTE)) {
        return [];
      }
      return snapshotForSync();
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
        rememberPresenceKeys(userId, value);
        options.onPresenceChange(userId, value, false);
        // Count presence peers even when getUsers() lags (ICE / Pages).
        touchFallbackPeer(userId);
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
      if (fallbackPresenceTimer) clearInterval(fallbackPresenceTimer);
      for (const pending of pendingSync.values()) {
        window.clearTimeout(pending.timer);
        pending.resolve(pending.added);
      }
      pendingSync.clear();
      if (fallback) {
        try {
          await fallback.publish({
            v: 1,
            t: 'goodbye',
            userId: self.userId,
            atMs: Date.now(),
          });
        } catch {
          /* ignore */
        }
        fallback.stop();
        fallback = null;
      }
      rateLimiter.clear();
      syncAnswerLimiter.clear();
      trustStore.clear();
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
    },
    setPresenceAlias: async (alias: string) => {
      const state = buildPresenceState(alias);
      lastPresence = state;
      if (state.encPubKeyRawB64) knownEncPubKeys.set(self.userId, state.encPubKeyRawB64);
      await presence.set(state);
      options.onPresenceChange(self.userId, state, false);
      await publishPresenceFallback(state);
    },
    publishEvent: async (partial) => {
      if (left) throw new P2pActionError('unknown', 'P2P session already closed');
      if (!rateLimiter.allow(self.userId, MAX_PUBLISH_PER_MINUTE)) {
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
        authorUserId: self.userId,
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
        await fallback.publish({ v: 1, t: 'forum', event: signed });
      } else if (relayFallbackNotified) {
        const bus = await ensureFallback();
        await bus?.publish({ v: 1, t: 'forum', event: signed });
      }
    },
    sendDirectMessage: async (toUserId: string, body: string): Promise<DirectMessage> => {
      if (left) throw new P2pActionError('unknown', 'P2P session already closed');
      const trimmed = body.slice(0, MAX_DM_BODY_CHARS);
      if (!trimmed.trim()) throw new P2pActionError('unknown', 'Empty DM body');

      const peerEnc = knownEncPubKeys.get(toUserId) ?? presence.get(toUserId)?.encPubKeyRawB64;
      if (peerEnc) knownEncPubKeys.set(toUserId, peerEnc);

      let unsigned: Omit<DirectMessage, 'sig'>;
      if (encIdentity && peerEnc) {
        const cipher = await sealDmBody(trimmed, encIdentity, peerEnc);
        if (!cipher) {
          throw new P2pActionError('unknown', 'Failed to seal Susurro');
        }
        unsigned = {
          protocolVersion: PROTOCOL_VERSION,
          msgId: crypto.randomUUID(),
          fromUserId: self.userId,
          toUserId,
          body: '',
          bodyCipherB64: cipher,
          seal: 2,
          createdAtMs: Date.now(),
        };
      } else {
        unsigned = {
          protocolVersion: PROTOCOL_VERSION,
          msgId: crypto.randomUUID(),
          fromUserId: self.userId,
          toUserId,
          body: trimmed,
          createdAtMs: Date.now(),
        };
      }

      const signed = await signDirectMessage(unsigned, signing);
      try {
        await directMsg.send(signed, { target: toUserId });
      } catch {
        /* fallback */
      }
      if (fallback || relayFallbackNotified) {
        const bus = fallback ?? (await ensureFallback());
        await bus?.publish({ v: 1, t: 'dm', dm: signed });
      }
      // Local echo shows plaintext for the sender UI.
      return { ...signed, body: trimmed, bodyCipherB64: undefined, seal: undefined };
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
      const targets = Object.keys(room.getUsers()).filter((id) => id !== self.userId);
      let added = 0;

      if (targets.length > 0) {
        try {
          const results = await forumSync.requestMany(
            { want: 'snapshot' },
            { targets, timeoutMs: 8000 }
          );
          for (const res of results) {
            if (res.status !== 'fulfilled' || !Array.isArray(res.value)) continue;
            const raw = JSON.stringify(res.value);
            if (new TextEncoder().encode(raw).byteLength > MAX_SYNC_TOTAL_BYTES) {
              rejectedSyncCount += 1;
              continue;
            }
            for (const item of res.value.slice(0, MAX_SYNC_MESSAGES)) {
              const ok = await ingestSigned(item, { liveUserId: null, source: 'sync' });
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

      // Always also ask Nostr path when fallback is (or becomes) active / alone.
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
  };
}
