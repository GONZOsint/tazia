import type { LocalProfile } from '../core/crypto/identity';
import type { JoinedP2pRoom } from '../core/p2p/p2pTypes';
import type {
  DirectMessage,
  ForumMessage,
  MeshStatus,
  PresenceState,
} from '../core/protocol';
import type { TrustStore, TrustLevel } from '../core/trust/trustStore';
import type { SessionError } from './sessionErrors';

export type { SessionError } from './sessionErrors';

export interface RoomJoinParams {
  roomId: string;
  secretPhrase: string;
  customAlias?: string;
}

export interface RoomState {
  roomId: string;
  phrase: string;
  profile: LocalProfile;
  selfUserId: string;
  selfSignPubKeyB64: string;
  trustStore: TrustStore;
  session: JoinedP2pRoom;
  messages: ForumMessage[];
  presence: Record<string, PresenceState>;
  onlineUserIds: string[];
  meshStatus: MeshStatus;
  rejectedSyncCount: number;
  isPublishing: boolean;
  isSyncing: boolean;
  roomError: SessionError;
  transportNotice: SessionError;
  /** Sticky: encrypted relay path active (survives toast dismiss). */
  relayFallbackActive: boolean;
  keyChangeAlerts: Array<{ userId: string; level: TrustLevel }>;
  unreadCount: number;
  dmMessages: Record<string, DirectMessage[]>;
  dmUnread: Record<string, number>;
}

export const MAX_ROOMS = 3;

export function countOtherPeers(
  onlineUserIds: string[],
  selfUserId: string | null | undefined
): number {
  if (!selfUserId) return onlineUserIds.length;
  return onlineUserIds.filter((id) => id !== selfUserId).length;
}

export function peerOnlineCount(r: { onlineUserIds: string[]; selfUserId: string }): number {
  return countOtherPeers(r.onlineUserIds, r.selfUserId);
}

export function deriveMeshStatus(r: {
  isSyncing: boolean;
  onlineUserIds: string[];
  selfUserId: string;
}): MeshStatus {
  if (peerOnlineCount(r) > 0) return 'mesh';
  if (r.isSyncing) return 'syncing';
  return 'alone';
}
