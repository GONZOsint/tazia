import type { Room, Unsubscribe } from 'trystero';
import {
  MAX_DM_CIPHER_B64_CHARS,
  MAX_DM_PER_MINUTE,
  MAX_FORUM_WIRE_BYTES,
  MAX_PRESENCE_STATE_BYTES,
  MAX_RECEIVE_BYTES,
  isValidPresenceState,
  type DirectMessage,
  type ForumEvent,
  type PresenceState,
} from '../protocol';
import type { FallbackBridge } from './fallbackBridge';
import type { DmIngest } from './dmIngest';
import type { ForumIngest } from './forumIngest';
import { emptyPresence } from './p2pPresenceState';
import type { P2pOnlineCoordinator } from './p2pOnline';
import type { P2pSessionBag } from './p2pSubsystems';
import type { JoinP2pRoomOptions } from './p2pTypes';
import type { PeerRateLimiter } from './rateLimit';
import type { PresenceKeys } from './presenceKeys';
import {
  SyncVerify,
  WEBRTC_SYNC_REQ_ID,
  type ForumSyncResponse,
} from './syncVerify';

/** Action handles produced by wireTrysteroIngress — typed loosely for Trystero generics. */
export type TrysteroActions = {
  forumMsg: {
    send: (data: ForumEvent) => Promise<unknown>;
  };
  directMsg: {
    send: (data: DirectMessage, opts?: { target: string }) => Promise<unknown>;
  };
  forumSync: {
    requestMany: (
      data: { want: string },
      opts: { targets: string[]; timeoutMs: number }
    ) => Promise<
      Array<{
        status: string;
        value?: ForumSyncResponse;
        userId?: string;
      }>
    >;
  };
  presence: {
    set: (state: PresenceState) => Promise<unknown>;
    get: (userId: string) => PresenceState | null | undefined;
    getAll: () => Record<string, PresenceState | null | undefined>;
  };
};

export type TrysteroIngressDeps = {
  room: Room;
  forumIngest: ForumIngest;
  dmIngest: DmIngest;
  dmRateLimiter: PeerRateLimiter;
  syncVerify: SyncVerify;
  presenceKeys: PresenceKeys;
  fallbackBridge: FallbackBridge;
  online: P2pOnlineCoordinator;
  options: JoinP2pRoomOptions;
  session: P2pSessionBag;
};

export function wireTrysteroIngress(
  deps: TrysteroIngressDeps
): { actions: TrysteroActions; unsubs: Unsubscribe[] } {
  const unsubs: Unsubscribe[] = [];
  const { room } = deps;

  const forumMsg = room.makeAction<ForumEvent>('forumMsg');
  const directMsg = room.makeAction<DirectMessage>('directMsg');
  const forumSync = room.makeAction<{ want: string }, ForumSyncResponse>('forumSync', {
    kind: 'request',
  });
  const maxDmWire = MAX_DM_CIPHER_B64_CHARS + 2_048;
  unsubs.push(
    forumMsg.onReceive(({ byteLength }) => byteLength <= MAX_FORUM_WIRE_BYTES),
    directMsg.onReceive(({ byteLength }) => byteLength <= maxDmWire),
    forumSync.onReceive(({ byteLength }) => byteLength <= MAX_RECEIVE_BYTES)
  );
  const presence = room.makeUserState<PresenceState>('presence', emptyPresence(), {
    maxBytes: MAX_PRESENCE_STATE_BYTES,
    validate: (next) => isValidPresenceState(next),
  });

  unsubs.push(
    forumMsg.onMessage((data, { userId }) => {
      if (deps.session.left) return;
      void deps.forumIngest.ingest(data, { liveUserId: userId, source: 'live' });
    })
  );

  unsubs.push(
    directMsg.onMessage((data, { userId }) => {
      if (deps.session.left) return;
      if (!deps.dmRateLimiter.allow(userId, MAX_DM_PER_MINUTE)) return;
      void deps.dmIngest.accept(data, userId);
    })
  );

  unsubs.push(
    forumSync.onRequest((_data, context) => {
      if (!deps.syncVerify.allowSyncAnswer(context.userId)) {
        // Soft reject: empty payload fails verifyAndIngest on the requester
        // without throwing a raw Error across the Trystero request channel.
        return Promise.resolve({
          events: [],
          fromUserId: '',
          eventsDigest: '',
          sig: '',
        } satisfies ForumSyncResponse);
      }
      return deps.syncVerify.buildSignedSyncPayload(context.userId, WEBRTC_SYNC_REQ_ID);
    })
  );

  unsubs.push(
    presence.onChange(
      (value, { userId, removed }) => {
        if (deps.session.left) return;
        if (removed) {
          deps.online.notePeerGone(userId);
          return;
        }
        if (!value || !isValidPresenceState(value)) return;
        void deps.presenceKeys.rememberPresenceKeys(userId, value, 'webrtc').then(() => {
          if (deps.session.left) return;
          deps.options.onPresenceChange(userId, value, false);
        });
      },
      { replay: true }
    )
  );

  unsubs.push(
    room.onUserJoin(({ userId }) => {
      if (deps.session.left) return;
      deps.online.mergeOnline();
      deps.options.onUserJoined?.(userId);
    }, { replay: true })
  );

  unsubs.push(
    room.onUserLeave(({ userId }) => {
      if (deps.session.left) return;
      deps.online.notePeerGone(userId);
    })
  );

  unsubs.push(
    room.onError((err) => {
      if (deps.session.left) return;
      if (err.code === 'peer-connect-failed') {
        void (async () => {
          await deps.fallbackBridge.ensure();
          if (!deps.session.relayFallbackNotified) {
            deps.session.relayFallbackNotified = true;
            deps.options.onRelayFallback?.();
          }
        })();
        return;
      }
      deps.options.onError(err.code, err.message);
    })
  );

  return {
    actions: { forumMsg, directMsg, forumSync, presence },
    unsubs,
  };
}
