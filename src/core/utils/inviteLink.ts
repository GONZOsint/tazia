export interface ParsedInvite {
  roomId: string;
  /** Frase solo si venía en el fragmento (#roomId~frase). */
  phrase: string | null;
}

/** Keep in sync with public/scrub-phrase.js literals. */
export const MAX_ROOM_ID_CHARS = 128;
/** Hard ceiling for invite/QR phrases (memorable phrases are ~6 words). */
export const MAX_INVITE_PHRASE_CHARS = 512;

/** Enlace público: solo roomId. La frase va fuera de banda o tras ~ en el #. */
export function buildInviteUrl(roomId: string, phrase?: string): string {
  // Keep a trailing slash so relative assets (scrub-phrase.js) resolve under /tazia/
  // when the shared link is opened at …/tazia#… instead of …/tazia/#….
  let path = window.location.pathname;
  if (!path.endsWith('/')) path = `${path}/`;
  const base = `${window.location.origin}${path}#${encodeURIComponent(roomId)}`;
  if (phrase && phrase.trim()) {
    return `${base}~${encodeURIComponent(phrase.trim())}`;
  }
  return base;
}

export function parseInviteInput(raw: string): ParsedInvite | null {
  const cleaned = raw.trim();
  if (!cleaned) return null;

  let hashPart = cleaned;
  if (cleaned.includes('#')) {
    hashPart = cleaned.split('#').pop()?.trim() ?? '';
  }
  hashPart = hashPart.replace(/^#/, '');
  if (!hashPart) return null;

  const tilde = hashPart.indexOf('~');
  let roomRaw: string;
  let phrase: string | null = null;
  if (tilde >= 0) {
    roomRaw = hashPart.slice(0, tilde);
    try {
      phrase = decodeURIComponent(hashPart.slice(tilde + 1));
    } catch {
      phrase = hashPart.slice(tilde + 1);
    }
  } else {
    roomRaw = hashPart;
  }

  let roomId: string;
  try {
    roomId = decodeURIComponent(roomRaw).trim();
  } catch {
    roomId = roomRaw.trim();
  }
  if (!roomId || roomId.length < 4 || roomId.length > MAX_ROOM_ID_CHARS) return null;

  const trimmedPhrase = phrase?.trim() || null;
  if (trimmedPhrase && trimmedPhrase.length > MAX_INVITE_PHRASE_CHARS) return null;

  return { roomId, phrase: trimmedPhrase };
}

export function formatClockTime(ms: number, locale: string = 'es'): string {
  return new Date(ms).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Quita la frase del hash dejando solo #roomId. */
export function scrubPhraseFromLocationHash(roomId: string): void {
  const next = `${window.location.pathname}${window.location.search}#${encodeURIComponent(roomId)}`;
  window.history.replaceState(null, '', next);
}

const INVITE_BOOT_KEY = 'tazia-invite-boot';

/** Survives remount/HMR after sessionStorage wipe until join succeeds or clear. */
let invitePhraseLatch: { roomId: string; phrase: string } | null = null;

/** Overwrite then remove — reduces residual plaintext if storage is inspected mid-clear. */
function wipeInviteBootKey(): void {
  try {
    sessionStorage.setItem(INVITE_BOOT_KEY, '');
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(INVITE_BOOT_KEY);
  } catch {
    /* ignore */
  }
}

/** Keep phrase across remount after URL scrub (until join / clear). */
export function latchInvitePhrase(roomId: string, phrase: string): void {
  const trimmed = phrase.trim();
  if (!roomId || !trimmed || trimmed.length > MAX_INVITE_PHRASE_CHARS) return;
  if (roomId.length > MAX_ROOM_ID_CHARS) return;
  invitePhraseLatch = { roomId, phrase: trimmed };
}

/** Drop in-memory invite phrase (after successful join or explicit form clear). */
export function clearInvitePhraseLatch(roomId?: string): void {
  if (!invitePhraseLatch) return;
  if (roomId && invitePhraseLatch.roomId !== roomId) return;
  invitePhraseLatch = null;
}

/** Read+clear phrase stashed by public/scrub-phrase.js before React booted. */
export function takeBootstrappedInvitePhrase(roomId: string): string | null {
  if (invitePhraseLatch && invitePhraseLatch.roomId === roomId) {
    return invitePhraseLatch.phrase;
  }
  try {
    const raw = sessionStorage.getItem(INVITE_BOOT_KEY);
    if (!raw) return null;
    let parsed: { roomId?: string; phrase?: string };
    try {
      parsed = JSON.parse(raw) as { roomId?: string; phrase?: string };
    } catch {
      wipeInviteBootKey();
      return null;
    }
    if (!parsed?.phrase || typeof parsed.phrase !== 'string') {
      wipeInviteBootKey();
      return null;
    }
    if (parsed.roomId && parsed.roomId.length > MAX_ROOM_ID_CHARS) {
      wipeInviteBootKey();
      return null;
    }
    // Wrong room → wipe so a later open cannot autofill another zone's phrase.
    if (parsed.roomId && parsed.roomId !== roomId) {
      wipeInviteBootKey();
      return null;
    }
    const phrase = parsed.phrase.trim();
    if (!phrase || phrase.length > MAX_INVITE_PHRASE_CHARS) {
      wipeInviteBootKey();
      return null;
    }
    wipeInviteBootKey();
    invitePhraseLatch = { roomId: parsed.roomId || roomId, phrase };
    return phrase;
  } catch {
    wipeInviteBootKey();
    return null;
  }
}
