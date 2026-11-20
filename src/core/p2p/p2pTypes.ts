import type { DirectMessage, ForumEvent, PresenceState } from '../protocol';
import type { TrustStore, TrustLevel } from '../trust/trustStore';
import type { RoomErrorCode } from 'trystero';

export type P2pRoomErrorCode = RoomErrorCode | 'publish-rate' | 'wire-too-large' | 'unknown';

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
  trustStore: TrustStore;
  leave: () => Promise<void>;
  setPresenceAlias: (alias: string) => Promise<void>;
  setPresenceProfile: (alias: string, avatarSeed: string) => Promise<void>;
  publishEvent: (partial: {
    msgId: string;
    type: ForumEvent['type'];
    threadId: string;
    parentMsgId: string | null;
    title: string;
    body: string;
    createdAtMs: number;
  }) => Promise<void>;
  sendDirectMessage: (toUserId: string, body: string) => Promise<DirectMessage>;
  requestSyncFromPeers: () => Promise<number>;
  /** Re-arm fallback + presence after background/offline (Trystero has no restartIce). */
  nudgeTransport: () => Promise<void>;
  getPresenceMap: () => Record<string, PresenceState>;
  getOnlineUserIds: () => string[];
  getRejectedSyncCount: () => number;
  /** Forum events ingested before RoomState was committed (join dead-zone). */
  getForumSnapshot: () => ForumEvent[];
  /** Opened DMs accepted before RoomState was committed (join dead-zone). */
  getDmSnapshot: () => DirectMessage[];
  /** After TrustStore.repin — reload VerifyKey for that peer. */
  invalidatePeerKey: (userId: string) => Promise<void>;
}

export interface JoinP2pRoomOptions {
  roomId: string;
  password: string;
  onForumMessage: (message: ForumEvent) => void;
  /** Unanimous tribe delete — drop talk content from UI state. */
  onThreadDeleted?: (threadId: string) => void;
  onPresenceChange: (userId: string, state: PresenceState | null, removed: boolean) => void;
  onPeerPresence: (onlineUserIds: string[]) => void;
  onUserJoined?: (userId: string) => void;
  onKeyChange?: (userId: string, level: TrustLevel) => void;
  onDirectMessage?: (dm: DirectMessage) => void;
  onError: (code: P2pRoomErrorCode, message: string) => void;
  onRelayFallback?: () => void;
  /** Sync/history reject — keep RoomState.rejectedSyncCount fresh without waiting for runSync. */
  onRejectedSync?: () => void;
  rtcConfig?: RTCConfiguration;
  turnConfig?: RTCIceServer[];
  relayOnly?: boolean;
  /** Custom Nostr wss:// relays; omit to keep Trystero defaults. */
  relayUrls?: string[];
}
