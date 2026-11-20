import { describe, expect, it } from 'vitest';
import { isP2pCallbackLive } from './p2pCallbacks';
import type { RoomState } from '../roomManagerTypes';

describe('isP2pCallbackLive', () => {
  it('rejects when room is missing or join token drifted', () => {
    const roomsRef = { current: new Map<string, RoomState>() };
    const joinTokensRef = { current: new Map<string, number>() };
    joinTokensRef.current.set('zone1', 3);
    expect(isP2pCallbackLive(roomsRef, joinTokensRef, 'zone1', 3)).toBe(false);

    roomsRef.current.set('zone1', {} as RoomState);
    expect(isP2pCallbackLive(roomsRef, joinTokensRef, 'zone1', 3)).toBe(true);
    expect(isP2pCallbackLive(roomsRef, joinTokensRef, 'zone1', 2)).toBe(false);
  });
});
