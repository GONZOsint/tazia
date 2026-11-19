# Protocol TAZEP (`tazep-v2`)

English · [Español](PROTOCOL.es.md)

**TAZEP** (*TAZ Encryption Protocol*) is the **message format** for the P2P forum: what travels over Trystero 0.27 (Nostr signaling + WebRTC), how it is signed, and what gets rejected.

Source of truth: [`src/core/protocol.ts`](../src/core/protocol.ts) and domain tags in [`src/core/crypto/`](../src/core/crypto/), [`src/core/p2p/`](../src/core/p2p/). If a number in this doc disagrees with the code, **trust the code**.

Peers on `agora-forum-v1` / `agora-forum-v2` do **not** talk to `tazep-v2` (no dual-stack compatibility). Domain tags: `tazep.*` (not `tazia.*`).

---

## Constants

| Name | Value |
| --- | --- |
| `PROTOCOL_NAME` | `tazep-v2` |
| `PROTOCOL_VERSION` | `2` |
| `APP_ID` | `tazia.app` (product / Trystero id — not the protocol name) |
| `MAX_USERS` | 50 |
| `MESH_SOFT_WARN_PEERS` | 6 (UX warning; mesh sweet spot) |
| `MAX_SYNC_PEER_TARGETS` | 8 (WebRTC sync sample) |
| `MAX_BODY_CHARS` | 8000 |
| `MAX_TITLE_CHARS` | 200 |
| `MAX_ALIAS_CHARS` | 40 |
| `MAX_USER_ID_CHARS` | 64 |
| `MAX_SIG_B64_CHARS` | 128 |
| `MAX_DM_BODY_CHARS` | 4000 |
| `MAX_DM_CIPHER_B64_CHARS` | 12_000 |
| `MAX_DM_PER_MINUTE` | 30 |
| `MAX_SYNC_MESSAGES` | 500 |
| `MAX_SYNC_TOTAL_BYTES` | 2 MB |
| `MAX_RECEIVE_BYTES` | ≈ 2.5 MB (`MAX_SYNC_TOTAL_BYTES + 512 KiB`) |
| `MAX_PRESENCE_STATE_BYTES` | 4096 |
| `MAX_PUBLISH_PER_MINUTE` | 30 |
| `MAX_SYNC_ANSWERS_PER_MINUTE` | 12 |
| `LIVE_CLOCK_SKEW_MS` | ±5 min (live forum + DMs) |
| `SYNC_CLOCK_SKEW_MS` | ±24 h (historical snapshot) |
| `NOSTR_EVENT_CLOCK_SKEW_SEC` | ±300 s (Nostr EVENT `created_at`) |

Versions other than `2` are **rejected**.  
UI only (not on the wire): up to **3** concurrent zones (`MAX_ROOMS`).

`MAX_USERS=50` is Trystero’s soft cap. Full WebRTC mesh degrades past ~4–6 peers; live sync samples at most `MAX_SYNC_PEER_TARGETS` peers.

---

## Changes vs agora-forum-v2

| Area | agora-forum-v2 | tazep-v2 |
| --- | --- | --- |
| Name / domain tags | `agora-forum-v2`, `tazia.*` | `tazep-v2`, `tazep.*` |
| Whispers | sealed-only `seal: 2` | same |
| Presence attestation | `tazia.presence.v1` | `tazep.presence.v1` |
| Goodbye (Nostr) | unauthenticated | attested `tazep.goodbye.v1` |
| Nostr `sync-res` | first encrypted reply wins | `fromUserId` + Ed25519 over `tazep.sync-res.v1` + events digest |
| Verify keys | latest observed SPKI | **pinned** TOFU (sign+enc) until `repin` |
| Presence attest | `tazep.presence.v1` (no time) | `tazep.presence.v3` + `atMs` + `alias` |
| WebRTC sync | raw `ForumEvent[]` | signed digest (`tazep.sync-res.v1`, reqId `webrtc-sync`) |

---

## Trystero channels

| Channel | Type | Use |
| --- | --- | --- |
| `forumMsg` | `makeAction` | Live publish (threads / replies) |
| `directMsg` | `makeAction` | Whispers to a `target` |
| `forumSync` | `makeAction(..., { kind: 'request' })` | Snapshot RPC for late joiners |
| `presence` | `makeUserState` | Alias + signing pubkey + X25519 |

```ts
joinRoom(
  { appId, password, identity: 'none', maxUsers, maxReceiveBytes, turnConfig?, rtcConfig? },
  roomId
)
```

Each UI zone is an isolated `joinP2pRoom`. Join **requires** SubtleCrypto X25519 (no polyfill).

---

## Presence

```ts
{
  alias: string;              // 1–40 chars
  signPubKeySpkiB64: string;  // SPKI Ed25519, base64
  encPubKeyRawB64: string;    // X25519 raw, base64 — required
}
```

Without a valid `signPubKeySpkiB64`, that author’s messages are not accepted in **sync** (nor live until the key is known / pinned).  
Without `encPubKeyRawB64`, presence is rejected; there are no cleartext Whispers.

Nostr presence also carries `attestSig` over:

```
["tazep.presence.v3", roomId, userId, signPubKeySpkiB64, encPubKeyRawB64, atMs, alias]
```

`atMs` must be within `LIVE_CLOCK_SKEW_MS` and **strictly increasing** per `userId` at the receiver. Attestation binds keys + alias to a claimed `userId` (first-writer TOFU). It does **not** equal Trystero WebRTC binding. Signing SPKI and X25519 enc are **pinned together**; a `changed` sign key does **not** update the enc key used for Susurros, and enc is not silently rotated under the same SPKI. WebRTC presence is preferred over Nostr when both exist for the same `userId`.

Nostr goodbye (on leave while fallback is active):

```
["tazep.goodbye.v3", roomId, userId, signPubKeySpkiB64, encPubKeyRawB64, atMs]
```

Goodbye only drops a peer when `signPubKeySpkiB64` matches the pinned key.

---

## Forum event

```ts
{
  protocolVersion: 2;
  msgId: string;
  type: 'NEW_THREAD' | 'REPLY';
  threadId: string;
  parentMsgId: string | null;
  title: string;
  body: string;
  createdAtMs: number;
  authorUserId: string;
  sig: string; // Ed25519 over canonical, base64 (IEEE P1363 / raw)
}
```

### Signed canonical

Fixed order (JSON array), **without** `sig`. **No `roomId`** — room binding is via the mesh / sealed DMs / fallback AAD:

```
[protocolVersion, msgId, type, threadId, parentMsgId, title, body, createdAtMs, authorUserId]
```

**Live WebRTC:** accept only if `authorUserId ===` Trystero peer `userId`, then verify against **pinned** SPKI.  
**Sync / Nostr fallback:** no transport binding; rate-limit by `authorUserId`; verify pinned SPKI.

---

## Whisper (DM)

```ts
{
  protocolVersion: 2;
  msgId: string;
  fromUserId: string;
  toUserId: string;
  body: "";                  // empty on the wire
  createdAtMs: number;
  bodyCipherB64: string;     // AES-GCM (iv||ct) base64
  seal: 2;
  sig: string;
}
```

Signed canonical:

```
[protocolVersion, msgId, fromUserId, toUserId, body, createdAtMs, bodyCipherB64, seal]
```

- AES-GCM AAD: `tazep.dm.aad.v2:{roomId}|{from}|{to}|{msgId}`
- HKDF salt: `tazep/dm-v2:{roomId}` · info: `tazep/dm-v2`
- Live clock ±5 min; `body` must be empty; `seal` must be `2`
- WebRTC: `fromUserId` must match transport peer; always open for `toUserId === self`

---

## Nostr data-plane fallback

When ICE fails (`peer-connect-failed`), TAZIA may carry encrypted envelopes over Trystero’s open Nostr relay sockets.

Room material: PBKDF2 210k once (salt `tazep.fallback.v2:{roomId}`) + dual HKDF (`tazep/room-key`, `tazep/topic`); blob **`0x03`** + AAD `tazep.fallback.aad.v3:{roomId}`; envelope `v: 2`.

| `t` | Fields (beyond `v: 2`) | Auth |
| --- | --- | --- |
| `forum` | `event` | Ed25519 on event; ingest without live transport binding |
| `presence` | `userId`, `state`, `atMs`, `attestSig` | `tazep.presence.v3` |
| `goodbye` | `userId`, keys, `atMs`, `attestSig` | `tazep.goodbye.v3` |
| `dm` | `dm` | Same as Whisper wire |
| `sync-req` | `fromUserId`, `reqId` | — |
| `sync-res` | `fromUserId`, `toUserId`, `reqId`, `events`, `eventsDigest`, `sig` | see below |

- EVENT: schnorr verify of canonical id + `created_at` skew **before** decrypt.
- `sync-res`: `eventsDigest = hex(SHA-256(JSON.stringify(events)))`; sig over  
  `["tazep.sync-res.v1", roomId, reqId, fromUserId, toUserId, eventsDigest]`.
- Relays see metadata and ciphertext, not plaintext. Not true P2P.

---

## Flow

```
publish → Ed25519_sign → forumMsg.send
                      ↘ onMessage: author==userId + verify(pinned)

whisper → X25519 seal + Ed25519_sign → directMsg.send({ target })
                      ↘ seal=2 required; open with peer encPub

late joiner → forumSync.requestMany / Nostr sync-req → sync-res (signed)
           → verify each event with pinned presence pubkey
```

---

## Implementation map

| Concern | Path |
| --- | --- |
| Types / validators | [`src/core/protocol.ts`](../src/core/protocol.ts) |
| Ed25519 sign/verify + sync-res | [`src/core/crypto/messageSigning.ts`](../src/core/crypto/messageSigning.ts) |
| Presence / goodbye attest | [`src/core/crypto/presenceAttest.ts`](../src/core/crypto/presenceAttest.ts) |
| DM seal | [`src/core/crypto/dmCrypto.ts`](../src/core/crypto/dmCrypto.ts) |
| Passphrase | [`src/core/crypto/passphraseWords.ts`](../src/core/crypto/passphraseWords.ts) |
| Mesh | [`src/core/p2p/p2pRoom.ts`](../src/core/p2p/p2pRoom.ts) |
| Forum / DM ingest | [`forumIngest.ts`](../src/core/p2p/forumIngest.ts), [`dmIngest.ts`](../src/core/p2p/dmIngest.ts) |
| Pinned verify cache | [`verifyKeyRegistry.ts`](../src/core/p2p/verifyKeyRegistry.ts) |
| Nostr fallback | [`nostrFallback.ts`](../src/core/p2p/nostrFallback.ts), [`roomCrypto.ts`](../src/core/p2p/roomCrypto.ts) |
| Multi-zone | [`src/hooks/useRoomManager.ts`](../src/hooks/useRoomManager.ts) |
| Papers | [`papers/`](papers/) |

---

## Sync roadmap

Today: signed-event merge + snapshot RPC (WebRTC + signed Nostr `sync-res`). Eventual typed sync (e.g. CRDT) is future — it does not replace Ed25519 authorship signatures. MLS / KT remain out of scope for ephemeral `identity: 'none'` hosting.
