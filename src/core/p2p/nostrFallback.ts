/**
 * Encrypted Nostr data-plane fallback when WebRTC ICE fails (e.g. GitHub Pages + CGNAT).
 * Reuses Trystero's open relay sockets; payloads are AES-GCM under the room phrase (TAZEP).
 *
 * Inbound EVENTs are schnorr-verified before decrypt. Presence/goodbye require attestSig.
 * sync-res requires fromUserId + Ed25519 sig (verified in p2pRoom).
 */
import { schnorr } from '@noble/secp256k1';
import { getRelaySockets } from '@trystero-p2p/nostr';
import { bytesToHex, hexToBytes } from '../crypto/bytes';
import { NOSTR_EVENT_CLOCK_SKEW_SEC, type DirectMessage, type ForumEvent, type PresenceState } from '../protocol';
import { decryptJson, deriveSessionMaterial, encryptJson } from './roomCrypto';

export type FallbackEnvelope =
  | { v: 2; t: 'forum'; event: ForumEvent }
  | {
      v: 2;
      t: 'presence';
      userId: string;
      state: PresenceState;
      atMs: number;
      /** Ed25519 over canonical presence attestation — required. */
      attestSig: string;
    }
  | {
      v: 2;
      t: 'goodbye';
      userId: string;
      atMs: number;
      signPubKeySpkiB64: string;
      encPubKeyRawB64: string;
      attestSig: string;
    }
  | { v: 2; t: 'dm'; dm: DirectMessage }
  | { v: 2; t: 'sync-req'; fromUserId: string; reqId: string }
  | {
      v: 2;
      t: 'sync-res';
      fromUserId: string;
      toUserId: string;
      reqId: string;
      events: ForumEvent[];
      eventsDigest: string;
      sig: string;
    };

export interface SyncResPayload {
  events: ForumEvent[];
  fromUserId: string;
  eventsDigest: string;
  sig: string;
}

export interface NostrFallbackHandlers {
  onForum: (event: ForumEvent) => void;
  onPresence: (userId: string, state: PresenceState, attestSig: string) => void;
  onGoodbye: (
    userId: string,
    signPubKeySpkiB64: string,
    encPubKeyRawB64: string,
    attestSig: string
  ) => void;
  onDirectMessage: (dm: DirectMessage) => void;
  onSyncRequest: (fromUserId: string, reqId: string) => Promise<SyncResPayload | null>;
  onSyncResponse: (
    reqId: string,
    fromUserId: string,
    events: ForumEvent[],
    eventsDigest: string,
    sig: string
  ) => void;
}

export interface NostrFallbackBus {
  publish: (env: FallbackEnvelope) => Promise<void>;
  stop: () => void;
}

type SchnorrSigner = { secretKey: Uint8Array; publicKey: Uint8Array };

const te = new TextEncoder();

function topicToKind(topic: string): number {
  let h = 2166136261;
  for (let i = 0; i < topic.length; i++) h = Math.imul(h ^ topic.charCodeAt(i), 16777619);
  return (h >>> 0) % 10_000 + 20_000;
}

function eventIdBytes(
  pubkey: string,
  created_at: number,
  kind: number,
  tags: string[][],
  content: string
): Promise<Uint8Array> {
  return crypto.subtle
    .digest('SHA-256', te.encode(JSON.stringify([0, pubkey, created_at, kind, tags, content])))
    .then((buf) => new Uint8Array(buf));
}

async function createSignedEvent(
  topic: string,
  content: string,
  signer: SchnorrSigner
): Promise<string> {
  const pubkey = bytesToHex(signer.publicKey);
  const created_at = Math.floor(Date.now() / 1000);
  const kind = topicToKind(topic);
  const tags = [['x', topic]];
  const idBytes = await eventIdBytes(pubkey, created_at, kind, tags, content);
  const id = bytesToHex(idBytes);
  const sig = bytesToHex(await schnorr.signAsync(idBytes, signer.secretKey));
  return JSON.stringify(['EVENT', { kind, tags, created_at, content, pubkey, id, sig }]);
}

async function verifyNostrEvent(ev: {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}): Promise<boolean> {
  try {
    const idBytes = await eventIdBytes(ev.pubkey, ev.created_at, ev.kind, ev.tags, ev.content);
    if (bytesToHex(idBytes) !== ev.id.toLowerCase()) return false;
    const pub = hexToBytes(ev.pubkey);
    const sig = hexToBytes(ev.sig);
    if (!pub || !sig || pub.length !== 32 || sig.length !== 64) return false;
    return await schnorr.verifyAsync(sig, idBytes, pub);
  } catch {
    return false;
  }
}

function openSockets(): WebSocket[] {
  try {
    return Object.values(getRelaySockets()).filter((ws) => ws.readyState === WebSocket.OPEN);
  } catch {
    return [];
  }
}

export async function startNostrFallback(
  roomId: string,
  password: string,
  selfUserId: string,
  handlers: NostrFallbackHandlers
): Promise<NostrFallbackBus> {
  const { roomKey: key, topicId: topic } = await deriveSessionMaterial(roomId, password);
  const kind = topicToKind(topic);
  const subId = `tazep-fb-${crypto.randomUUID().slice(0, 8)}`;
  const signer = schnorr.keygen() as SchnorrSigner;
  const seenEventIds = new Set<string>();
  const SEEN_EVENT_CAP = 4_000;
  const listeners = new Map<WebSocket, (ev: MessageEvent) => void>();
  let stopped = false;
  let attachTimer: number | null = null;

  const handlePayload = (env: FallbackEnvelope) => {
    if (stopped) return;
    switch (env.t) {
      case 'forum':
        handlers.onForum(env.event);
        break;
      case 'presence':
        if (env.userId !== selfUserId && typeof env.attestSig === 'string' && env.attestSig) {
          handlers.onPresence(env.userId, env.state, env.attestSig);
        }
        break;
      case 'goodbye':
        if (
          env.userId !== selfUserId &&
          typeof env.attestSig === 'string' &&
          env.attestSig &&
          typeof env.signPubKeySpkiB64 === 'string' &&
          typeof env.encPubKeyRawB64 === 'string'
        ) {
          handlers.onGoodbye(env.userId, env.signPubKeySpkiB64, env.encPubKeyRawB64, env.attestSig);
        }
        break;
      case 'dm':
        if (env.dm.toUserId === selfUserId) handlers.onDirectMessage(env.dm);
        break;
      case 'sync-req': {
        if (env.fromUserId === selfUserId) break;
        void handlers.onSyncRequest(env.fromUserId, env.reqId).then((payload) => {
          if (!payload || stopped) return;
          void publish({
            v: 2,
            t: 'sync-res',
            fromUserId: payload.fromUserId,
            toUserId: env.fromUserId,
            reqId: env.reqId,
            events: payload.events,
            eventsDigest: payload.eventsDigest,
            sig: payload.sig,
          });
        });
        break;
      }
      case 'sync-res':
        if (
          env.toUserId === selfUserId &&
          typeof env.fromUserId === 'string' &&
          typeof env.eventsDigest === 'string' &&
          typeof env.sig === 'string'
        ) {
          handlers.onSyncResponse(env.reqId, env.fromUserId, env.events, env.eventsDigest, env.sig);
        }
        break;
      default:
        break;
    }
  };

  const onWsMessage = async (raw: MessageEvent) => {
    if (stopped) return;
    let msg: unknown;
    try {
      msg = JSON.parse(String(raw.data));
    } catch {
      return;
    }
    if (!Array.isArray(msg) || msg[0] !== 'EVENT' || !msg[2] || typeof msg[2] !== 'object') return;
    const ev = msg[2] as {
      id?: string;
      kind?: number;
      tags?: string[][];
      content?: string;
      pubkey?: string;
      created_at?: number;
      sig?: string;
    };
    if (
      ev.kind !== kind ||
      typeof ev.content !== 'string' ||
      typeof ev.id !== 'string' ||
      typeof ev.pubkey !== 'string' ||
      typeof ev.sig !== 'string' ||
      typeof ev.created_at !== 'number' ||
      !Array.isArray(ev.tags)
    ) {
      return;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ev.created_at) > NOSTR_EVENT_CLOCK_SKEW_SEC) return;
    const tagOk = ev.tags.some((t) => t[0] === 'x' && t[1] === topic);
    if (!tagOk) return;
    if (seenEventIds.has(ev.id)) return;
    seenEventIds.add(ev.id);
    if (seenEventIds.size > SEEN_EVENT_CAP) {
      const first = seenEventIds.values().next().value;
      if (first) seenEventIds.delete(first);
    }
    const okSig = await verifyNostrEvent({
      id: ev.id,
      pubkey: ev.pubkey,
      created_at: ev.created_at,
      kind: ev.kind,
      tags: ev.tags,
      content: ev.content,
      sig: ev.sig,
    });
    if (!okSig) return;
    const env = await decryptJson<FallbackEnvelope>(key, ev.content, roomId);
    if (!env || env.v !== 2) return;
    handlePayload(env);
  };

  const attach = () => {
    if (stopped) return;
    for (const ws of openSockets()) {
      if (listeners.has(ws)) continue;
      const fn = (ev: MessageEvent) => {
        void onWsMessage(ev);
      };
      ws.addEventListener('message', fn);
      listeners.set(ws, fn);
      const since = Math.max(0, Math.floor(Date.now() / 1000) - 90);
      try {
        ws.send(JSON.stringify(['REQ', subId, { kinds: [kind], '#x': [topic], since }]));
      } catch {
        /* ignore */
      }
    }
    for (const ws of [...listeners.keys()]) {
      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        const fn = listeners.get(ws);
        if (fn) {
          try {
            ws.removeEventListener('message', fn);
          } catch {
            /* ignore */
          }
        }
        listeners.delete(ws);
      }
    }
  };

  attach();
  attachTimer = window.setInterval(attach, 12_000);

  const publish = async (env: FallbackEnvelope) => {
    if (stopped) return;
    await new Promise((r) => window.setTimeout(r, Math.floor(Math.random() * 280)));
    if (stopped) return;
    const content = await encryptJson(key, env, roomId);
    const wire = await createSignedEvent(topic, content, signer);
    attach();
    for (const ws of openSockets()) {
      try {
        ws.send(wire);
      } catch {
        /* ignore */
      }
    }
  };

  return {
    publish,
    stop: () => {
      stopped = true;
      if (attachTimer !== null) window.clearInterval(attachTimer);
      for (const [ws, fn] of listeners) {
        try {
          ws.removeEventListener('message', fn);
          ws.send(JSON.stringify(['CLOSE', subId]));
        } catch {
          /* ignore */
        }
      }
      listeners.clear();
    },
  };
}
