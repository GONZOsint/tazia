import { joinRoom, type Room } from 'trystero';
import { APP_ID, MAX_RECEIVE_BYTES, MAX_USERS } from '../protocol';
import { P2pActionError, type JoinP2pRoomOptions } from './p2pTypes';

export type OpenedTrysteroRoom = {
  room: Room;
  self: { userId: string };
};

/** RTC + joinRoom + ready + getSelf. Does not wipe identities — caller handles. */
export async function openTrysteroRoom(
  roomId: string,
  password: string,
  options: JoinP2pRoomOptions
): Promise<OpenedTrysteroRoom> {
  let room: Room;
  try {
    const rtcConfig: RTCConfiguration = {
      iceCandidatePoolSize: 8,
      ...options.rtcConfig,
      iceTransportPolicy: options.relayOnly
        ? 'relay'
        : (options.rtcConfig?.iceTransportPolicy ?? 'all'),
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
        ...(options.relayUrls?.length
          ? { relayConfig: { urls: options.relayUrls } }
          : {}),
      },
      roomId
    );
  } catch (err) {
    throw new P2pActionError(
      'unknown',
      err instanceof Error ? err.message : 'Failed to open Trystero room'
    );
  }

  await room.ready;
  const self = await room.getSelf();
  return { room, self };
}
