import { useMemo } from 'react';
import type { ForumMessageType } from '../../core/protocol';
import { countOtherPeers, type RoomState } from '../../hooks/useRoomManager';
import type { MessageKey } from '../../i18n';

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export type ActiveRoomView = {
  isInRoom: boolean;
  roomId: string | null;
  phrase: string | null;
  profile: RoomState['profile'] | null;
  selfUserId: string | null;
  selfSignPubKeyB64: string | null;
  trustStore: RoomState['trustStore'] | null;
  messages: RoomState['messages'];
  presence: RoomState['presence'];
  presenceAliases: Record<string, string>;
  presenceAvatarSeeds: Record<string, string>;
  onlineUserIds: string[];
  peerOnlineCount: number;
  isPublishing: boolean;
  isSyncing: boolean;
  meshStatus: RoomState['meshStatus'];
  rejectedSyncCount: number;
  roomErrorMsg: string | null;
  dmMessages: RoomState['dmMessages'];
  dmUnread: RoomState['dmUnread'];
  relayActive: boolean;
  transportNotice: RoomState['transportNotice'];
  keyChangeAlerts: RoomState['keyChangeAlerts'];
};

export type RoomPanelActions = {
  publish: (input: {
    type: ForumMessageType;
    threadId: string;
    parentMsgId: string | null;
    title: string;
    body: string;
  }) => Promise<boolean>;
  syncNow: () => Promise<void>;
  sendDm: (toUserId: string, body: string) => Promise<boolean>;
  clearDmUnread: (peerId: string) => void;
  dismissRoomError: () => void;
  joinRoom: (params: {
    roomId: string;
    secretPhrase: string;
    customAlias?: string;
  }) => Promise<void>;
  switchRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => Promise<void>;
  /** After Tribu SAS repin — refresh peer crypto + dismiss key-change alert. */
  resolvePeerTrust: (userId: string) => void;
};

export function useActiveRoomView(
  activeRoom: RoomState | null,
  presenceAliases: Record<string, string>,
  presenceAvatarSeeds: Record<string, string>,
  t: Translate
): ActiveRoomView {
  return useMemo(() => {
    const onlineUserIds = activeRoom?.onlineUserIds ?? [];
    const selfUserId = activeRoom?.selfUserId ?? null;
    const roomError = activeRoom?.roomError ?? null;
    return {
      isInRoom: activeRoom !== null,
      roomId: activeRoom?.roomId ?? null,
      phrase: activeRoom?.phrase ?? null,
      profile: activeRoom?.profile ?? null,
      selfUserId,
      selfSignPubKeyB64: activeRoom?.selfSignPubKeyB64 ?? null,
      trustStore: activeRoom?.trustStore ?? null,
      messages: activeRoom?.messages ?? [],
      presence: activeRoom?.presence ?? {},
      presenceAliases,
      presenceAvatarSeeds,
      onlineUserIds,
      peerOnlineCount: countOtherPeers(onlineUserIds, selfUserId),
      isPublishing: activeRoom?.isPublishing ?? false,
      isSyncing: activeRoom?.isSyncing ?? false,
      meshStatus: activeRoom?.meshStatus ?? 'connecting',
      rejectedSyncCount: activeRoom?.rejectedSyncCount ?? 0,
      roomErrorMsg: roomError ? t(roomError.key, roomError.vars) : null,
      dmMessages: activeRoom?.dmMessages ?? {},
      dmUnread: activeRoom?.dmUnread ?? {},
      relayActive: Boolean(activeRoom?.relayFallbackActive),
      transportNotice: activeRoom?.transportNotice ?? null,
      keyChangeAlerts: activeRoom?.keyChangeAlerts ?? [],
    };
  }, [activeRoom, presenceAliases, presenceAvatarSeeds, t]);
}
