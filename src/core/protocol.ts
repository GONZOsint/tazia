/**
 * TAZEP — TAZ Encryption Protocol (`tazep-v2`).
 *
 * Breaking vs agora-forum-v2 / v1:
 * - PROTOCOL_NAME = tazep-v2 (domain tags tazep.*)
 * - PROTOCOL_VERSION = 2
 * - Susurros sealed-only (seal:2 + bodyCipherB64; empty body)
 * - Presence requires encPubKeyRawB64
 */

import { b64ToBytes } from './crypto/bytes';
import { isValidAvatarSeed } from './avatar/avatarSeed';
import {
  DELETE_VOTE_AYE,
  isValidDeleteElectorateBody,
} from './forum/threadDelete';

export const PROTOCOL_NAME = 'tazep-v2';
export const PROTOCOL_VERSION = 2 as const;

/** RFC 8410 SPKI prefix for Ed25519 (12 bytes) + 32-byte raw key. */
const ED25519_SPKI_PREFIX = Uint8Array.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);
const ED25519_SPKI_LEN = 44;
const X25519_RAW_LEN = 32;
/** Opaque peer / msg ids: no `|` so AAD field concat stays unambiguous. */
const SAFE_ID_RE = /^[A-Za-z0-9_-]+$/;

function isExactB64Length(b64: string, byteLen: number): boolean {
  try {
    return b64ToBytes(b64).length === byteLen;
  } catch {
    return false;
  }
}

function isValidEd25519SpkiB64(b64: string): boolean {
  try {
    const bytes = b64ToBytes(b64);
    if (bytes.length !== ED25519_SPKI_LEN) return false;
    for (let i = 0; i < ED25519_SPKI_PREFIX.length; i++) {
      if (bytes[i] !== ED25519_SPKI_PREFIX[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Forum wire types.
 * - NEW_THREAD / REPLY — plaza talk
 * - DELETE_PROPOSE — freeze online tribe as electorate (body = sorted userIds)
 * - DELETE_VOTE — aye for a propose (parentMsgId = propose msgId, body = "aye")
 * Unanimous aye among the frozen electorate deletes the talk on every peer.
 */
export type ForumMessageType =
  | 'NEW_THREAD'
  | 'REPLY'
  | 'DELETE_PROPOSE'
  | 'DELETE_VOTE';

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
  /** X25519 raw public key (base64) — required in v2 for Susurro seal. */
  encPubKeyRawB64: string;
  /** Compact flame avatar seed (required). */
  avatarSeed: string;
}

export const APP_ID = 'tazia.app';

export const MAX_USERS = 50;
/** Soft UX warn: full mesh degrades past ~4–6 peers (SnoW / WebRTC scale). */
export const MESH_SOFT_WARN_PEERS = 6;
/** Cap WebRTC sync fan-out so large rooms do not N×N snapshot storms. */
export const MAX_SYNC_PEER_TARGETS = 8;
export const MAX_BODY_CHARS = 8000;
export const MAX_TITLE_CHARS = 200;
export const MAX_ALIAS_CHARS = 40;
export const MAX_USER_ID_CHARS = 64;
export const MAX_SIG_B64_CHARS = 128;
/**
 * Worst-case UTF-8 JSON size for one `forumMsg` (title/body may expand to
 * `\uXXXX` escapes; ids/sig/framing covered by the fixed overhead).
 */
export const MAX_FORUM_WIRE_BYTES =
  4_096 + MAX_TITLE_CHARS * 6 + MAX_BODY_CHARS * 6 + MAX_SIG_B64_CHARS;
export const MAX_SYNC_MESSAGES = 500;
export const MAX_PUBLISH_PER_MINUTE = 30;
/** Soft cap for Susurro sends per peer (WebRTC + Nostr fallback). */
export const MAX_DM_PER_MINUTE = 30;
/** Respuestas sync por peer y minuto (anti-abuso blando). */
export const MAX_SYNC_ANSWERS_PER_MINUTE = 12;
/** Soft cap for Nostr fallback presence/goodbye per EVENT pubkey. */
export const MAX_PRESENCE_PER_MINUTE = 20;
/** Ventana de reloj para mensajes en vivo (±5 min). */
export const LIVE_CLOCK_SKEW_MS = 5 * 60 * 1000;
/** Ventana de reloj para mensajes de sync histórico (±24 h). */
export const SYNC_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;
/** Max bytes totals aceptados en una respuesta de sync (2 MB). */
export const MAX_SYNC_TOTAL_BYTES = 2 * 1024 * 1024;
/** Trystero maxReceiveBytes — must be ≥ sync payload + framing. */
export const MAX_RECEIVE_BYTES = MAX_SYNC_TOTAL_BYTES + 512 * 1024;
/** Soft cap for presence makeUserState JSON. */
export const MAX_PRESENCE_STATE_BYTES = 4_096;
/** Soft cap for Nostr EVENT created_at skew (±5 min). */
export const NOSTR_EVENT_CLOCK_SKEW_SEC = 300;

export type MeshStatus = 'connecting' | 'alone' | 'mesh' | 'syncing';

/** Direct message between two peers (sealed-only in v2). */
export interface DirectMessage {
  protocolVersion: typeof PROTOCOL_VERSION;
  msgId: string;
  fromUserId: string;
  toUserId: string;
  /** Always empty on the wire in v2; plaintext only after local open. */
  body: string;
  createdAtMs: number;
  /** AES-GCM ciphertext (base64) sealed with pairwise X25519 + room AAD. */
  bodyCipherB64: string;
  /** Seal version; always `2` in v2. */
  seal: 2;
  /** Ed25519 signature over canonical DM payload. */
  sig: string;
}

export const MAX_DM_BODY_CHARS = 4000;
export const MAX_DM_CIPHER_B64_CHARS = 12_000;

export function canonicalDmPayload(dm: Omit<DirectMessage, 'sig'>): string {
  return JSON.stringify([
    dm.protocolVersion,
    dm.msgId,
    dm.fromUserId,
    dm.toUserId,
    dm.body,
    dm.createdAtMs,
    dm.bodyCipherB64,
    dm.seal,
  ]);
}

export function isValidDirectMessage(value: unknown): value is DirectMessage {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.protocolVersion !== PROTOCOL_VERSION) return false;
  if (
    typeof v.msgId !== 'string' ||
    v.msgId.length < 8 ||
    v.msgId.length > 80 ||
    !SAFE_ID_RE.test(v.msgId)
  ) {
    return false;
  }
  if (
    typeof v.fromUserId !== 'string' ||
    v.fromUserId.length < 4 ||
    v.fromUserId.length > MAX_USER_ID_CHARS ||
    !SAFE_ID_RE.test(v.fromUserId)
  ) {
    return false;
  }
  if (
    typeof v.toUserId !== 'string' ||
    v.toUserId.length < 4 ||
    v.toUserId.length > MAX_USER_ID_CHARS ||
    !SAFE_ID_RE.test(v.toUserId)
  ) {
    return false;
  }
  if (typeof v.body !== 'string' || v.body.length !== 0) return false;
  if (v.seal !== 2) return false;
  if (
    typeof v.bodyCipherB64 !== 'string' ||
    v.bodyCipherB64.length < 16 ||
    v.bodyCipherB64.length > MAX_DM_CIPHER_B64_CHARS
  ) {
    return false;
  }
  if (typeof v.createdAtMs !== 'number' || !Number.isFinite(v.createdAtMs)) return false;
  if (Math.abs(Date.now() - v.createdAtMs) > LIVE_CLOCK_SKEW_MS) return false;
  if (typeof v.sig !== 'string' || v.sig.length < 16 || v.sig.length > MAX_SIG_B64_CHARS) return false;
  return true;
}

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

const forumWireTe = new TextEncoder();

/** UTF-8 byte length of the JSON object Trystero sends on `forumMsg`. */
export function forumEventWireBytes(event: ForumEvent): number {
  return forumWireTe.encode(JSON.stringify(event)).length;
}

export function isForumEventWithinWireBudget(event: ForumEvent): boolean {
  return forumEventWireBytes(event) <= MAX_FORUM_WIRE_BYTES;
}

export function isValidForumEvent(
  value: unknown,
  opts?: { nowMs?: number; requireFreshClock?: boolean; clockSource?: 'live' | 'sync' }
): value is ForumEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.protocolVersion !== PROTOCOL_VERSION) return false;
  if (
    typeof v.msgId !== 'string' ||
    v.msgId.length < 8 ||
    v.msgId.length > 80 ||
    !SAFE_ID_RE.test(v.msgId)
  ) {
    return false;
  }
  if (
    v.type !== 'NEW_THREAD' &&
    v.type !== 'REPLY' &&
    v.type !== 'DELETE_PROPOSE' &&
    v.type !== 'DELETE_VOTE'
  ) {
    return false;
  }
  if (
    typeof v.threadId !== 'string' ||
    !v.threadId ||
    v.threadId.length > 80 ||
    !SAFE_ID_RE.test(v.threadId)
  ) {
    return false;
  }
  if (v.type === 'NEW_THREAD' || v.type === 'DELETE_PROPOSE') {
    if (v.parentMsgId !== null) return false;
  } else {
    // REPLY | DELETE_VOTE
    if (typeof v.parentMsgId !== 'string' || !v.parentMsgId || v.parentMsgId.length > 80) {
      return false;
    }
    if (!SAFE_ID_RE.test(v.parentMsgId)) return false;
  }
  if (
    typeof v.authorUserId !== 'string' ||
    v.authorUserId.length < 4 ||
    v.authorUserId.length > MAX_USER_ID_CHARS ||
    !SAFE_ID_RE.test(v.authorUserId)
  ) {
    return false;
  }
  if (typeof v.title !== 'string' || v.title.length > MAX_TITLE_CHARS) return false;
  if (typeof v.body !== 'string' || v.body.length === 0 || v.body.length > MAX_BODY_CHARS) {
    return false;
  }
  if (v.type === 'DELETE_PROPOSE') {
    if (v.title.length !== 0) return false;
    if (!isValidDeleteElectorateBody(v.body, v.authorUserId)) return false;
  } else if (v.type === 'DELETE_VOTE') {
    if (v.title.length !== 0) return false;
    if (v.body !== DELETE_VOTE_AYE) return false;
  }
  if (typeof v.createdAtMs !== 'number' || !Number.isFinite(v.createdAtMs)) return false;
  if (typeof v.sig !== 'string' || v.sig.length < 16 || v.sig.length > MAX_SIG_B64_CHARS) {
    return false;
  }

  if (opts?.requireFreshClock !== false) {
    const now = opts?.nowMs ?? Date.now();
    const skew = opts?.clockSource === 'sync' ? SYNC_CLOCK_SKEW_MS : LIVE_CLOCK_SKEW_MS;
    if (Math.abs(now - v.createdAtMs) > skew) return false;
  }
  return true;
}

export function isValidPresenceState(value: unknown): value is PresenceState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.alias !== 'string' || v.alias.length === 0 || v.alias.length > MAX_ALIAS_CHARS) {
    return false;
  }
  if (typeof v.signPubKeySpkiB64 !== 'string' || !isValidEd25519SpkiB64(v.signPubKeySpkiB64)) {
    return false;
  }
  if (typeof v.encPubKeyRawB64 !== 'string' || !isExactB64Length(v.encPubKeyRawB64, X25519_RAW_LEN)) {
    return false;
  }
  if (!isValidAvatarSeed(v.avatarSeed)) {
    return false;
  }
  return true;
}
