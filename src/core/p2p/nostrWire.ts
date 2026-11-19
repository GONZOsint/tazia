/**
 * Low-level Nostr EVENT create/verify + Trystero relay socket helpers.
 * Internal to the p2p package — used by nostrFallback only.
 */
import { schnorr } from '@noble/secp256k1';
import { getRelaySockets } from '@trystero-p2p/nostr';
import { bytesToHex, hexToBytes } from '../crypto/bytes';

export type SchnorrSigner = { secretKey: Uint8Array; publicKey: Uint8Array };

const te = new TextEncoder();

export function topicToKind(topic: string): number {
  let h = 2166136261;
  for (let i = 0; i < topic.length; i++) h = Math.imul(h ^ topic.charCodeAt(i), 16777619);
  return (h >>> 0) % 10_000 + 20_000;
}

export function eventIdBytes(
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

export async function createSignedEvent(
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

export async function verifyNostrEvent(ev: {
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

export function openSockets(): WebSocket[] {
  try {
    return Object.values(getRelaySockets()).filter((ws) => ws.readyState === WebSocket.OPEN);
  } catch {
    return [];
  }
}

export function keygenSchnorrSigner(): SchnorrSigner {
  return schnorr.keygen() as SchnorrSigner;
}
