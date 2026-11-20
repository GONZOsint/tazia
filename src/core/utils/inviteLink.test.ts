import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_INVITE_PHRASE_CHARS,
  MAX_ROOM_ID_CHARS,
  parseInviteInput,
  takeBootstrappedInvitePhrase,
} from './inviteLink';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

describe('parseInviteInput caps', () => {
  it('accepts roomId at MAX_ROOM_ID_CHARS', () => {
    const roomId = 'a'.repeat(MAX_ROOM_ID_CHARS);
    expect(parseInviteInput(roomId)).toEqual({ roomId, phrase: null });
  });

  it('rejects roomId over MAX_ROOM_ID_CHARS', () => {
    expect(parseInviteInput('a'.repeat(MAX_ROOM_ID_CHARS + 1))).toBeNull();
  });

  it('rejects roomId shorter than 4', () => {
    expect(parseInviteInput('abc')).toBeNull();
  });

  it('accepts phrase at MAX_INVITE_PHRASE_CHARS', () => {
    const phrase = 'p'.repeat(MAX_INVITE_PHRASE_CHARS);
    expect(parseInviteInput(`abcd~${phrase}`)).toEqual({ roomId: 'abcd', phrase });
  });

  it('rejects phrase over MAX_INVITE_PHRASE_CHARS', () => {
    expect(parseInviteInput(`abcd~${'p'.repeat(MAX_INVITE_PHRASE_CHARS + 1)}`)).toBeNull();
  });

  it('parses hash-form invites', () => {
    expect(parseInviteInput('https://example.com/tazia/#zone1~secret words')).toEqual({
      roomId: 'zone1',
      phrase: 'secret words',
    });
  });
});

describe('takeBootstrappedInvitePhrase room mismatch', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: memoryStorage(),
      configurable: true,
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('wipes stash when roomId does not match', () => {
    sessionStorage.setItem(
      'tazia-invite-boot',
      JSON.stringify({ roomId: 'zone-a', phrase: 'secret phrase here' })
    );
    expect(takeBootstrappedInvitePhrase('zone-b')).toBeNull();
    expect(sessionStorage.getItem('tazia-invite-boot')).toBeNull();
  });

  it('consumes matching stash', () => {
    sessionStorage.setItem(
      'tazia-invite-boot',
      JSON.stringify({ roomId: 'zone-a', phrase: 'secret phrase here' })
    );
    expect(takeBootstrappedInvitePhrase('zone-a')).toBe('secret phrase here');
    expect(sessionStorage.getItem('tazia-invite-boot')).toBeNull();
  });
});
