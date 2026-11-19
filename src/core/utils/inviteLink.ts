export interface ParsedInvite {
  roomId: string;
  /** Frase solo si venía en el fragmento (#roomId~frase). */
  phrase: string | null;
}

/** Enlace público: solo roomId. La frase va fuera de banda o tras ~ en el #. */
export function buildInviteUrl(roomId: string, phrase?: string): string {
  const base = `${window.location.origin}${window.location.pathname}#${encodeURIComponent(roomId)}`;
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
  if (!roomId || roomId.length < 4) return null;

  return { roomId, phrase: phrase?.trim() || null };
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

/** Read+clear phrase stashed by public/scrub-phrase.js before React booted. */
export function takeBootstrappedInvitePhrase(roomId: string): string | null {
  try {
    const raw = sessionStorage.getItem(INVITE_BOOT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(INVITE_BOOT_KEY);
    const parsed = JSON.parse(raw) as { roomId?: string; phrase?: string };
    if (!parsed?.phrase || typeof parsed.phrase !== 'string') return null;
    if (parsed.roomId && parsed.roomId !== roomId) return null;
    const phrase = parsed.phrase.trim();
    return phrase || null;
  } catch {
    try {
      sessionStorage.removeItem(INVITE_BOOT_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}
