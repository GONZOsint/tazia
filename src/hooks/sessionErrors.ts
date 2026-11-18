import type { MessageKey } from '../i18n';
import type { P2pRoomErrorCode } from '../core/p2p/p2pRoom';

export type SessionError =
  | { key: MessageKey; vars?: Record<string, string | number> }
  | null;

export function mapRoomError(code: P2pRoomErrorCode): MessageKey {
  switch (code) {
    case 'decrypt-failed':
      return 'errDecrypt';
    case 'room-full':
      return 'errRoomFull';
    case 'peer-connect-failed':
      return 'errPeerConnect';
    case 'relay-failed':
      return 'errRelay';
    case 'publish-rate':
      return 'errPublishRate';
    default:
      return 'errGeneric';
  }
}
