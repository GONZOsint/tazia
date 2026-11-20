import { describe, expect, it } from 'vitest';
import { bytesToB64 } from './crypto/bytes';
import {
  MAX_BODY_CHARS,
  MAX_DM_CIPHER_B64_CHARS,
  MAX_FALLBACK_CIPHER_B64_CHARS,
  MAX_FORUM_WIRE_BYTES,
  PROTOCOL_VERSION,
  forumEventWireBytes,
  isFallbackCipherWithinCap,
  isForumEventWithinWireBudget,
  isValidDirectMessage,
  isValidForumEvent,
  isValidPresenceState,
  type DirectMessage,
  type ForumEvent,
  type PresenceState,
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

function baseForum(overrides: Partial<ForumEvent> = {}): ForumEvent {
  return {
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
    ...overrides,
  };
}

/** Valid-shaped Ed25519 SPKI (44 bytes, RFC 8410 prefix). */
function fakeSpkiB64(): string {
  const bytes = new Uint8Array(44);
  bytes.set([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00]);
  return bytesToB64(bytes);
}

function fakeX25519B64(): string {
  return bytesToB64(new Uint8Array(32));
}

function basePresence(overrides: Partial<PresenceState> = {}): PresenceState {
  return {
    alias: 'peer',
    signPubKeySpkiB64: fakeSpkiB64(),
    encPubKeyRawB64: fakeX25519B64(),
    avatarSeed: 'v1.0.0.0.0.0.00000000',
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

  it('rejects cipher over MAX_DM_CIPHER_B64_CHARS', () => {
    expect(
      isValidDirectMessage(baseDm({ bodyCipherB64: 'C'.repeat(MAX_DM_CIPHER_B64_CHARS + 1) }))
    ).toBe(false);
  });
});

describe('isValidForumEvent', () => {
  it('rejects wrong protocol version', () => {
    expect(isValidForumEvent({ ...baseForum(), protocolVersion: 1 as 2 })).toBe(false);
  });

  it('rejects NEW_THREAD with parentMsgId', () => {
    expect(isValidForumEvent(baseForum({ parentMsgId: 'parent01abcdefgh' }))).toBe(false);
  });
});

describe('forum wire budget', () => {
  it('keeps a normal event under MAX_FORUM_WIRE_BYTES', () => {
    const event = baseForum();
    expect(forumEventWireBytes(event)).toBeLessThan(MAX_FORUM_WIRE_BYTES);
    expect(isForumEventWithinWireBudget(event)).toBe(true);
  });

  it('keeps max-length ASCII body under budget (char caps ≤ wire ceiling)', () => {
    const event = baseForum({
      title: 't'.repeat(200),
      body: 'b'.repeat(MAX_BODY_CHARS),
    });
    expect(isValidForumEvent(event)).toBe(true);
    expect(isForumEventWithinWireBudget(event)).toBe(true);
  });

  it('rejects when UTF-8 JSON exceeds MAX_FORUM_WIRE_BYTES (ingest defense-in-depth)', () => {
    // Oversized vs char validators — forumIngest checks wire budget separately.
    const event = baseForum({ body: 'x'.repeat(MAX_FORUM_WIRE_BYTES) });
    expect(forumEventWireBytes(event)).toBeGreaterThan(MAX_FORUM_WIRE_BYTES);
    expect(isForumEventWithinWireBudget(event)).toBe(false);
  });
});

describe('isValidPresenceState', () => {
  it('accepts canonical alias', () => {
    expect(isValidPresenceState(basePresence())).toBe(true);
  });

  it('rejects bidi-spoofed alias', () => {
    expect(isValidPresenceState(basePresence({ alias: '\u202Eevil' }))).toBe(false);
  });

  it('rejects padded alias', () => {
    expect(isValidPresenceState(basePresence({ alias: ' peer ' }))).toBe(false);
  });

  it('rejects empty alias', () => {
    expect(isValidPresenceState(basePresence({ alias: '' }))).toBe(false);
  });
});

describe('isFallbackCipherWithinCap', () => {
  it('accepts content at the ceiling', () => {
    expect(isFallbackCipherWithinCap('x'.repeat(MAX_FALLBACK_CIPHER_B64_CHARS))).toBe(true);
  });

  it('rejects content over the ceiling', () => {
    expect(isFallbackCipherWithinCap('x'.repeat(MAX_FALLBACK_CIPHER_B64_CHARS + 1))).toBe(false);
  });
});
