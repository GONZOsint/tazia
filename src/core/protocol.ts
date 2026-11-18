/**
 * Protocolo agora-forum-v1 (P2P / Trystero).
 *
 * - En vivo: authorUserId se fuerza al userId Trystero del peer.
 * - Sync: solo se aceptan eventos con firma Ed25519 válida frente a la
 *   clave publicada en presencia (o vista en vivo).
 */

export const PROTOCOL_NAME = 'agora-forum-v1';
export const PROTOCOL_VERSION = 1 as const;

export type ForumMessageType = 'NEW_THREAD' | 'REPLY';

/** Payload firmado que viaja por makeAction / sync. */
export interface ForumEvent {
  protocolVersion: typeof PROTOCOL_VERSION;
  msgId: string;
  type: ForumMessageType;
  threadId: string;
  parentMsgId: string | null;
  title: string;
  body: string;
  createdAtMs: number;
  authorUserId: string;
  /** Firma Ed25519 (IEEE P1363 / raw) en base64 sobre el canónico. */
  sig: string;
}

export type ForumMessage = ForumEvent;

export interface PresenceState {
  alias: string;
  /** Clave pública de firma (SPKI) en base64. */
  signPubKeySpkiB64: string;
}

export const APP_ID = 'tazia.app';

export const MAX_USERS = 48;
export const MAX_BODY_CHARS = 8000;
export const MAX_TITLE_CHARS = 200;
export const MAX_ALIAS_CHARS = 40;
export const MAX_USER_ID_CHARS = 64;
export const MAX_SIG_B64_CHARS = 128;
export const MAX_SYNC_MESSAGES = 500;
export const MAX_PUBLISH_PER_MINUTE = 30;
/** Respuestas sync por peer y minuto (anti-abuso blando). */
export const MAX_SYNC_ANSWERS_PER_MINUTE = 12;
/** Ventana de reloj aceptada (±) para anti-spam básico. */
export const CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;

export type MeshStatus = 'connecting' | 'alone' | 'mesh' | 'syncing';

/** Campos firmados en orden canónico (sin `sig`). */
export function canonicalForumPayload(event: Omit<ForumEvent, 'sig'>): string {
  return JSON.stringify([
    event.protocolVersion,
    event.msgId,
    event.type,
    event.threadId,
    event.parentMsgId,
    event.title,
    event.body,
    event.createdAtMs,
    event.authorUserId,
  ]);
}

export function isValidForumEvent(
  value: unknown,
  opts?: { nowMs?: number; requireFreshClock?: boolean }
): value is ForumEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.protocolVersion !== PROTOCOL_VERSION) return false;
  if (typeof v.msgId !== 'string' || v.msgId.length < 8 || v.msgId.length > 80) return false;
  if (v.type !== 'NEW_THREAD' && v.type !== 'REPLY') return false;
  if (typeof v.threadId !== 'string' || !v.threadId) return false;
  if (!(v.parentMsgId === null || typeof v.parentMsgId === 'string')) return false;
  if (typeof v.title !== 'string' || v.title.length > MAX_TITLE_CHARS) return false;
  if (typeof v.body !== 'string' || v.body.length === 0 || v.body.length > MAX_BODY_CHARS) {
    return false;
  }
  if (typeof v.createdAtMs !== 'number' || !Number.isFinite(v.createdAtMs)) return false;
  if (
    typeof v.authorUserId !== 'string' ||
    v.authorUserId.length < 4 ||
    v.authorUserId.length > MAX_USER_ID_CHARS
  ) {
    return false;
  }
  if (typeof v.sig !== 'string' || v.sig.length < 16 || v.sig.length > MAX_SIG_B64_CHARS) {
    return false;
  }

  if (opts?.requireFreshClock !== false) {
    const now = opts?.nowMs ?? Date.now();
    if (Math.abs(now - v.createdAtMs) > CLOCK_SKEW_MS) return false;
  }
  return true;
}

export function isValidPresenceState(value: unknown): value is PresenceState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.alias !== 'string' || v.alias.length === 0 || v.alias.length > MAX_ALIAS_CHARS) {
    return false;
  }
  if (typeof v.signPubKeySpkiB64 !== 'string' || v.signPubKeySpkiB64.length < 32) return false;
  return true;
}
