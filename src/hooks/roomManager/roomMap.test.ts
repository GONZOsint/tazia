import { describe, expect, it } from 'vitest';
import { roomListChromeEqual, sameOnlineIdSet } from './roomMap';
import type { RoomState } from '../roomManagerTypes';

function stubRoom(over: Partial<RoomState> = {}): RoomState {
  return {
    roomId: 'z1',
    unreadCount: 0,
    meshStatus: 'connected',
    relayFallbackActive: false,
    selfUserId: 'me',
    onlineUserIds: ['me'],
    dmUnread: {},
    ...over,
  } as RoomState;
}

describe('sameOnlineIdSet', () => {
  it('ignores order', () => {
    expect(sameOnlineIdSet(['a', 'b'], ['b', 'a'])).toBe(true);
  });
});

describe('roomListChromeEqual', () => {
  it('ignores message/presence body differences', () => {
    const a = stubRoom({ messages: [] as RoomState['messages'] });
    const b = stubRoom({
      messages: [{ msgId: '1' }] as unknown as RoomState['messages'],
      presence: { x: { alias: 'x' } } as unknown as RoomState['presence'],
    });
    expect(roomListChromeEqual(a, b)).toBe(true);
  });

  it('detects unread / mesh chrome changes', () => {
    const a = stubRoom();
    expect(roomListChromeEqual(a, stubRoom({ unreadCount: 1 }))).toBe(false);
    expect(roomListChromeEqual(a, stubRoom({ meshStatus: 'alone' }))).toBe(false);
    expect(roomListChromeEqual(a, stubRoom({ dmUnread: { p: 2 } }))).toBe(false);
    expect(roomListChromeEqual(a, stubRoom({ onlineUserIds: ['me', 'p'] }))).toBe(false);
  });
});
