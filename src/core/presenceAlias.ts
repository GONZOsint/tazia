/** Max presence alias length (also exported via protocol.ts). */
export const MAX_ALIAS_CHARS = 40;

/** LTR/RTL overrides + embedding controls — strip before length check (UI spoofing). */
const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/**
 * Canonical presence alias for publish + inbound validation.
 * Same rules peers enforce via `isValidPresenceState` (non-empty, ≤ MAX_ALIAS_CHARS, no bidi).
 */
export function normalizePresenceAlias(alias: string): string | null {
  const trimmed = alias.replace(BIDI_CONTROLS, '').trim();
  if (!trimmed || trimmed.length > MAX_ALIAS_CHARS) return null;
  return trimmed;
}
