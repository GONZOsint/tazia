/**
 * Encrypted Nostr data-plane fallback when WebRTC ICE fails (e.g. GitHub Pages + CGNAT).
 * Reuses Trystero's open relay sockets; payloads are AES-GCM under the room phrase.
 */
import { schnorr } from '@noble/secp256k1';
import { getRelaySockets } from '@trystero-p2p/nostr';
import type { DirectMessage, ForumEvent, PresenceState } from '../protocol';
import { decryptJson, deriveRoomKey, encryptJson, fallbackTopic } from './roomCrypto';

export type FallbackEnvelope =
  | { v: 1; t: 'forum'; event: ForumEvent }
  | { v: 1; t: 'presence'; userId: string; state: PresenceState; atMs: number }
  | { v: 1; t: 'goodbye'; userId: string; atMs: number }
  | { v: 1; t: 'dm'; dm: DirectMessage }
  | { v: 1; t: 'sync-req'; fromUserId: string; reqId: string }
  | { v: 1; t: 'sync-res'; toUserId: string; reqId: string; events: ForumEvent[] };

export interface NostrFallbackHandlers {
  onForum: (event: ForumEvent) => void;
  onPresence: (userId: string, state: PresenceState) => void;
  onGoodbye: (userId: string) => void;
  onDirectMessage: (dm: DirectMessage) => void;
  onSyncRequest: (fromUserId: string, reqId: string) => ForumEvent[];
  onSyncResponse: (reqId: string, events: ForumEvent[]) => void;
}

export interface NostrFallbackBus {
  publish: (env: FallbackEnvelope) => Promise<void>;
  stop: () => void;
}

type SchnorrSigner = { secretKey: Uint8Array; publicKey: Uint8Array };

const te = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function topicToKind(topic: string): number {
  let h = 2166136261;
  for (let i = 0; i < topic.length; i++) h = Math.imul(h ^ topic.charCodeAt(i), 16777619);
  return (h >>> 0) % 10_000 + 20_000;
}

async function createSignedEvent(
  topic: string,
  content: string,
  signer: SchnorrSigner
): Promise<string> {
  const pubkey = toHex(signer.publicKey);
  const created_at = Math.floor(Date.now() / 1000);
  const kind = topicToKind(topic);
  const tags = [['x', topic]];
  const idBytes = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      te.encode(JSON.stringify([0, pubkey, created_at, kind, tags, content]))
    )
  );
  const id = toHex(idBytes);
  const sig = toHex(await schnorr.signAsync(idBytes, signer.secretKey));
  return JSON.stringify(['EVENT', { kind, tags, created_at, content, pubkey, id, sig }]);
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
  const key = await deriveRoomKey(roomId, password);
  const topic = await fallbackTopic(roomId, password);
  const kind = topicToKind(topic);
  const subId = `tazia-fb-${crypto.randomUUID().slice(0, 8)}`;
  const signer = schnorr.keygen() as SchnorrSigner;
  const seenEventIds = new Set<string>();
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
        if (env.userId !== selfUserId) handlers.onPresence(env.userId, env.state);
        break;
      case 'goodbye':
        if (env.userId !== selfUserId) handlers.onGoodbye(env.userId);
        break;
      case 'dm':
        if (env.dm.toUserId === selfUserId) handlers.onDirectMessage(env.dm);
        break;
      case 'sync-req': {
        if (env.fromUserId === selfUserId) break;
        const events = handlers.onSyncRequest(env.fromUserId, env.reqId);
        void publish({
          v: 1,
          t: 'sync-res',
          toUserId: env.fromUserId,
          reqId: env.reqId,
          events,
        });
        break;
      }
      case 'sync-res':
        if (env.toUserId === selfUserId) handlers.onSyncResponse(env.reqId, env.events);
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
    const ev = msg[2] as { id?: string; kind?: number; tags?: string[][]; content?: string };
    if (ev.kind !== kind || typeof ev.content !== 'string' || typeof ev.id !== 'string') return;
    const tagOk = Array.isArray(ev.tags) && ev.tags.some((t) => t[0] === 'x' && t[1] === topic);
    if (!tagOk) return;
    if (seenEventIds.has(ev.id)) return;
    seenEventIds.add(ev.id);
    if (seenEventIds.size > 2000) {
      const first = seenEventIds.values().next().value;
      if (first) seenEventIds.delete(first);
    }
    const env = await decryptJson<FallbackEnvelope>(key, ev.content);
    if (!env || env.v !== 1) return;
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
    // Drop dead sockets from the map
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
  // Slow safety net for late-opening Trystero sockets (publish also calls attach).
  attachTimer = window.setInterval(attach, 12_000);

  const publish = async (env: FallbackEnvelope) => {
    if (stopped) return;
    const content = await encryptJson(key, env);
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
