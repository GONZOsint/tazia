import { joinRoom, type Room, type RoomErrorCode, type Unsubscribe } from 'trystero';
import {
  generateSigningIdentity,
  importVerifyKey,
  signForumEvent,
  verifyForumEvent,
  type SigningIdentity,
} from '../crypto/messageSigning';
import {
  APP_ID,
  MAX_PUBLISH_PER_MINUTE,
  MAX_SYNC_ANSWERS_PER_MINUTE,
  MAX_SYNC_MESSAGES,
  MAX_USERS,
  PROTOCOL_VERSION,
  isValidForumEvent,
  isValidPresenceState,
  type ForumEvent,
  type PresenceState,
} from '../protocol';
import { PeerRateLimiter } from './rateLimit';

export type P2pRoomErrorCode = RoomErrorCode | 'publish-rate' | 'unknown';

export class P2pActionError extends Error {
  readonly code: P2pRoomErrorCode;

  constructor(code: P2pRoomErrorCode, message = '') {
    super(message || code);
    this.name = 'P2pActionError';
    this.code = code;
  }
}

export interface JoinedP2pRoom {
  selfUserId: string;
  signPubKeySpkiB64: string;
  leave: () => Promise<void>;
  setPresenceAlias: (alias: string) => Promise<void>;
  publishEvent: (partial: {
    msgId: string;
    type: ForumEvent['type'];
    threadId: string;
    parentMsgId: string | null;
    title: string;
    body: string;
    createdAtMs: number;
  }) => Promise<void>;
  requestSyncFromPeers: () => Promise<number>;
  getPresenceMap: () => Record<string, PresenceState>;
  getOnlineUserIds: () => string[];
  getRejectedSyncCount: () => number;
}

export interface JoinP2pRoomOptions {
  roomId: string;
  password: string;
  onForumMessage: (message: ForumEvent) => void;
  onPresenceChange: (userId: string, state: PresenceState | null, removed: boolean) => void;
  onPeerPresence: (onlineUserIds: string[]) => void;
  onUserJoined?: (userId: string) => void;
  onError: (code: P2pRoomErrorCode, message: string) => void;
}

function emptyPresence(): PresenceState {
  return { alias: '', signPubKeySpkiB64: '' };
}

export async function joinP2pRoom(options: JoinP2pRoomOptions): Promise<JoinedP2pRoom> {
  const signing: SigningIdentity = await generateSigningIdentity();
  const verifyKeyCache = new Map<string, CryptoKey>();
  const knownPubKeys = new Map<string, string>();
  const rateLimiter = new PeerRateLimiter();
  const syncAnswerLimiter = new PeerRateLimiter();
  const localMessages = new Map<string, ForumEvent>();
  const unsubs: Unsubscribe[] = [];
  let rejectedSyncCount = 0;
  let left = false;

  const cachePubKey = async (userId: string, spkiB64: string): Promise<CryptoKey | null> => {
    if (!userId || !spkiB64 || spkiB64.length < 32) return null;
    knownPubKeys.set(userId, spkiB64);
    const existing = verifyKeyCache.get(userId);
    if (existing) return existing;
    try {
      const key = await importVerifyKey(spkiB64);
      verifyKeyCache.set(userId, key);
      return key;
    } catch {
      return null;
    }
  };

  const getVerifyKey = async (userId: string): Promise<CryptoKey | null> => {
    const cached = verifyKeyCache.get(userId);
    if (cached) return cached;
    const spki = knownPubKeys.get(userId);
    if (!spki) return null;
    return cachePubKey(userId, spki);
  };

  let room: Room;
  try {
    room = joinRoom(
      {
        appId: APP_ID,
        password: options.password.trim(),
        identity: 'none',
        maxUsers: MAX_USERS,
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

  const ingestSigned = async (
    event: ForumEvent,
    opts: { liveUserId: string | null; source: 'live' | 'sync' }
  ): Promise<boolean> => {
    if (!isValidForumEvent(event, { requireFreshClock: opts.source === 'live' })) {
      if (opts.source === 'sync') rejectedSyncCount += 1;
      return false;
    }

    if (opts.liveUserId) {
      if (event.authorUserId !== opts.liveUserId) return false;
      if (!rateLimiter.allow(opts.liveUserId, MAX_PUBLISH_PER_MINUTE)) {
        options.onError('publish-rate', 'Peer exceeded publish rate');
        return false;
      }
    }

    if (localMessages.has(event.msgId)) return false;

    const verifyKey = await getVerifyKey(event.authorUserId);
    if (!verifyKey) {
      if (opts.source === 'sync') rejectedSyncCount += 1;
      // En vivo sin pubkey aún: no aceptar (evita reenviar sync sin clave).
      return false;
    }

    const ok = await verifyForumEvent(event, verifyKey);
    if (!ok) {
      if (opts.source === 'sync') rejectedSyncCount += 1;
      return false;
    }

    localMessages.set(event.msgId, event);
    options.onForumMessage(event);
    return true;
  };

  unsubs.push(
    forumMsg.onMessage((data, { userId }) => {
      if (left) return;
      void ingestSigned(data, { liveUserId: userId, source: 'live' });
    })
  );

  unsubs.push(
    forumSync.onRequest((_data, context) => {
      if (!syncAnswerLimiter.allow(context.userId, MAX_SYNC_ANSWERS_PER_MINUTE)) {
        return [];
      }
      return [...localMessages.values()]
        .sort((a, b) => a.createdAtMs - b.createdAtMs)
        .slice(-MAX_SYNC_MESSAGES);
    })
  );

  unsubs.push(
    presence.onChange(
      (value, { userId, removed }) => {
        if (left) return;
        if (removed) {
          options.onPresenceChange(userId, null, true);
          return;
        }
        if (!value || !isValidPresenceState(value)) return;
        void cachePubKey(userId, value.signPubKeySpkiB64);
        options.onPresenceChange(userId, value, false);
      },
      { replay: true }
    )
  );

  const emitOnline = () => {
    options.onPeerPresence(Object.keys(room.getUsers()));
  };

  unsubs.push(
    room.onUserJoin(({ userId }) => {
      if (left) return;
      emitOnline();
      options.onUserJoined?.(userId);
    }, { replay: true })
  );
  unsubs.push(
    room.onUserLeave(() => {
      if (left) return;
      emitOnline();
    })
  );

  unsubs.push(
    room.onError((err) => {
      if (left) return;
      options.onError(err.code, err.message);
    })
  );

  emitOnline();

  return {
    selfUserId: self.userId,
    signPubKeySpkiB64: signing.publicKeySpkiB64,
    leave: async () => {
      if (left) return;
      left = true;
      rateLimiter.clear();
      syncAnswerLimiter.clear();
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
    },
    setPresenceAlias: async (alias: string) => {
      const state: PresenceState = {
        alias: alias.slice(0, 40),
        signPubKeySpkiB64: signing.publicKeySpkiB64,
      };
      await presence.set(state);
      options.onPresenceChange(self.userId, state, false);
    },
    publishEvent: async (partial) => {
      if (left) throw new P2pActionError('unknown', 'P2P session already closed');
      if (!rateLimiter.allow(self.userId, MAX_PUBLISH_PER_MINUTE)) {
        options.onError('publish-rate', 'Local publish rate limit');
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

      const signed = await signForumEvent(unsigned, signing.keyPair.privateKey);
      if (!isValidForumEvent(signed)) {
        throw new P2pActionError('unknown', 'Signed event failed local validation');
      }

      localMessages.set(signed.msgId, signed);
      options.onForumMessage(signed);
      await forumMsg.send(signed);
    },
    requestSyncFromPeers: async () => {
      if (left) return 0;
      const targets = Object.keys(room.getUsers()).filter((id) => id !== self.userId);
      if (targets.length === 0) return 0;

      try {
        const results = await forumSync.requestMany(
          { want: 'snapshot' },
          { targets, timeoutMs: 8000 }
        );
        let added = 0;
        for (const res of results) {
          if (res.status !== 'fulfilled' || !Array.isArray(res.value)) continue;
          const capped = res.value.slice(0, MAX_SYNC_MESSAGES);
          for (const item of capped) {
            const ok = await ingestSigned(item, { liveUserId: null, source: 'sync' });
            if (ok) added += 1;
          }
        }
        return added;
      } catch (err) {
        options.onError(
          'unknown',
          err instanceof Error ? err.message : 'Peer sync failed'
        );
        return 0;
      }
    },
    getPresenceMap: () => {
      const all = presence.getAll();
      const out: Record<string, PresenceState> = {};
      for (const [id, state] of Object.entries(all)) {
        if (state && isValidPresenceState(state)) out[id] = state;
      }
      return out;
    },
    getOnlineUserIds: () => Object.keys(room.getUsers()),
    getRejectedSyncCount: () => rejectedSyncCount,
  };
}
