import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, type ForumEvent } from '../protocol';
import {
  encodeElectorate,
  rejectDeleteEventReason,
} from './threadDelete';

function propose(partial: Partial<ForumEvent> & Pick<ForumEvent, 'body' | 'authorUserId'>): ForumEvent {
  return {
    protocolVersion: PROTOCOL_VERSION,
    msgId: 'propose01abcdefgh',
    type: 'DELETE_PROPOSE',
    threadId: 'thread01abcdefgh',
    parentMsgId: null,
    title: '',
    createdAtMs: 1_700_000_000_000,
    sig: 'B'.repeat(64),
    ...partial,
  };
}

describe('rejectDeleteEventReason', () => {
  it('rejects live propose that omits an already-online peer', () => {
    const event = propose({
      authorUserId: 'alice',
      body: encodeElectorate(['alice']),
    });
    const reason = rejectDeleteEventReason(event, new Map(), {
      source: 'live',
      onlineUserIds: ['alice', 'bob'],
    });
    expect(reason).toBe('delete-electorate-incomplete');
  });

  it('skips electorate cover for sync source', () => {
    const event = propose({
      authorUserId: 'alice',
      body: encodeElectorate(['alice']),
    });
    const reason = rejectDeleteEventReason(event, new Map(), {
      source: 'sync',
      onlineUserIds: ['alice', 'bob'],
    });
    expect(reason).toBeNull();
  });

  it('rejects a second DELETE_PROPOSE for the same thread', () => {
    const first = propose({
      authorUserId: 'alice',
      body: encodeElectorate(['alice', 'bob']),
    });
    const second = propose({
      msgId: 'propose02abcdefgh',
      authorUserId: 'alice',
      body: encodeElectorate(['alice', 'bob']),
    });
    const local = new Map([[first.msgId, first]]);
    expect(
      rejectDeleteEventReason(second, local, {
        source: 'live',
        onlineUserIds: ['alice', 'bob'],
      })
    ).toBe('delete-propose-exists');
  });
});
