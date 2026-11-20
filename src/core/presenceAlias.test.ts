import { describe, expect, it } from 'vitest';
import { MAX_ALIAS_CHARS, normalizePresenceAlias } from './presenceAlias';

describe('normalizePresenceAlias', () => {
  it('strips bidi controls', () => {
    expect(normalizePresenceAlias('\u202Eevil')).toBe('evil');
    expect(normalizePresenceAlias('\u200Ehi\u200F')).toBe('hi');
  });

  it('trims whitespace', () => {
    expect(normalizePresenceAlias('  alias  ')).toBe('alias');
  });

  it('rejects empty / whitespace-only / all-bidi', () => {
    expect(normalizePresenceAlias('')).toBeNull();
    expect(normalizePresenceAlias('   ')).toBeNull();
    expect(normalizePresenceAlias('\u202A\u202C')).toBeNull();
  });

  it('rejects over MAX_ALIAS_CHARS', () => {
    expect(normalizePresenceAlias('x'.repeat(MAX_ALIAS_CHARS + 1))).toBeNull();
    expect(normalizePresenceAlias('x'.repeat(MAX_ALIAS_CHARS))).toBe('x'.repeat(MAX_ALIAS_CHARS));
  });
});
