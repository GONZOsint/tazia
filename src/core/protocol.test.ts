import { describe, expect, it } from 'vitest';
import {
  MAX_FORUM_WIRE_BYTES,
  PROTOCOL_VERSION,
  forumEventWireBytes,
  isForumEventWithinWireBudget,
  isValidDirectMessage,
  type DirectMessage,
  type ForumEvent,
} from './protocol';

function baseDm(overrides: Partial<DirectMessage> = {}): DirectMessage {
  return {
    protocolVersion: PROTOCOL_VERSION,
    msgId: 'dmmsgid01abcdefgh',
    fromUserId: 'from01',
    toUserId: 'to001',
    body: '',
    createdAtMs: Date.now(),
    bodyCipherB64: 'E'.repeat(32),
    seal: 2,
    sig: 'F'.repeat(64),
    ...overrides,
  };
}

describe('isValidDirectMessage', () => {
  it('accepts seal:2 with empty body', () => {
    expect(isValidDirectMessage(baseDm())).toBe(true);
  });

  it('rejects non-empty body', () => {
    expect(isValidDirectMessage(baseDm({ body: 'leak' }))).toBe(false);
  });

  it('rejects seal !== 2', () => {
    expect(isValidDirectMessage({ ...baseDm(), seal: 1 as 2 })).toBe(false);
  });
});

describe('forum wire budget', () => {
  it('keeps a normal event under MAX_FORUM_WIRE_BYTES', () => {
    const event: ForumEvent = {
      protocolVersion: PROTOCOL_VERSION,
      msgId: 'msgId001abcdefgh',
      type: 'NEW_THREAD',
      threadId: 'msgId001abcdefgh',
      parentMsgId: null,
      title: 'hola',
      body: 'cuerpo',
      createdAtMs: Date.now(),
      authorUserId: 'author01',
      sig: 'G'.repeat(64),
    };
    expect(forumEventWireBytes(event)).toBeLessThan(MAX_FORUM_WIRE_BYTES);
    expect(isForumEventWithinWireBudget(event)).toBe(true);
  });
});
