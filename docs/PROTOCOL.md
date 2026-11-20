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
| `MAX_FALLBACK_CIPHER_B64_CHARS` | 96_000 (Nostr EVENT `content` before verify/decrypt) |
| `MAX_DM_PER_MINUTE` | 30 |
| `MAX_SYNC_MESSAGES` | 500 |
| `MAX_SYNC_TOTAL_BYTES` | 2 MB |
| `MAX_RECEIVE_BYTES` | ≈ 2.5 MB (`MAX_SYNC_TOTAL_BYTES + 512 KiB`) |
| `MAX_PRESENCE_STATE_BYTES` | 4096 |
| `MAX_FORUM_WIRE_BYTES` | `4096 + MAX_TITLE_CHARS×6 + MAX_BODY_CHARS×6 + MAX_SIG_B64_CHARS` (= 53 424) |
| `MAX_PUBLISH_PER_MINUTE` | 30 |
| `MAX_SYNC_ANSWERS_PER_MINUTE` | 12 |
| `MAX_PRESENCE_PER_MINUTE` | 20 (Nostr fallback presence/goodbye per EVENT pubkey) |
| Fallback global rate caps | `×3` the per-peer limits (anti-amplification soft hedge) |
| `LIVE_CLOCK_SKEW_MS` | ±5 min (live forum + DMs) |
| `SYNC_CLOCK_SKEW_MS` | ±24 h (historical snapshot) |
| `NOSTR_EVENT_CLOCK_SKEW_SEC` | ±300 s (Nostr EVENT `created_at`) |

Versions other than `2` are **rejected**.  
UI only (not on the wire): up to **3** concurrent zones (`MAX_ROOMS`).

`MAX_USERS=50` is Trystero’s soft cap. Full WebRTC mesh degrades past ~4–6 peers; live sync samples at most `MAX_SYNC_PEER_TARGETS` peers.

Rate limits are **client-only** soft hedges (in-memory). Nostr fallback keys them by EVENT pubkey; rotating pubkeys can multiply throughput up to the global `×3` buckets.

---

## Changes vs agora-forum-v2

| Area | agora-forum-v2 | tazep-v2 |
| --- | --- | --- |
| Name / domain tags | `agora-forum-v2`, `tazia.*` | `tazep-v2`, `tazep.*` |
| Whispers | sealed-only `seal: 2` | same |
| Presence attestation | `tazia.presence.v1` | `tazep.presence.v4` + `atMs` + `alias` + `avatarSeed` |
| Goodbye (Nostr) | unauthenticated | attested `tazep.goodbye.v3` + `atMs` |
| WebRTC sync | raw `ForumEvent[]` | signed digest (`tazep.sync-res.v1`, reqId `webrtc-sync`) |
| Nostr `sync-res` | first encrypted reply wins | `fromUserId` + Ed25519 over `tazep.sync-res.v1` + events digest; **merge** valid replies until timeout |
| Verify keys | latest observed SPKI | **pinned** TOFU (sign+enc) until `repin` |
| Talk delete | none (append-only) | unanimous `DELETE_PROPOSE` / `DELETE_VOTE` + tombstones |

---

## Trystero channels

| Channel | Type | Use |
| --- | --- | --- |
| `forumMsg` | `makeAction` | Live publish (threads / replies / delete ballot) |
| `directMsg` | `makeAction` | Whispers to a `target` |
| `forumSync` | `makeAction(..., { kind: 'request' })` | Snapshot RPC for late joiners |
| `presence` | `makeUserState` | Alias + signing pubkey + X25519 + avatarSeed |

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
  alias: string;              // 1–40 chars, canonical
  signPubKeySpkiB64: string;  // SPKI Ed25519, base64
  encPubKeyRawB64: string;    // X25519 raw, base64 — required
  avatarSeed: string;         // compact flame seed — required
}
```

`alias` must be **canonical**: trimmed, no Unicode bidi controls (`U+200E`, `U+200F`, `U+202A`–`U+202E`, `U+2066`–`U+2069`). Publishers run `normalizePresenceAlias` ([`src/core/presenceAlias.ts`](../src/core/presenceAlias.ts)); peers **reject** non-canonical aliases via `isValidPresenceState` (no silent rewrite).

Without a valid `signPubKeySpkiB64`, that author’s messages are not accepted in **sync** (nor live until the key is known / pinned).  
Without `encPubKeyRawB64`, presence is rejected; there are no cleartext Whispers.  
`avatarSeed` must match `v1.<p>.<f>.<e>.<m>.<d>.<hex8>` (see [`src/core/avatar/avatarSeed.ts`](../src/core/avatar/avatarSeed.ts)); invalid or missing seed rejects the presence state.

**WebRTC vs Nostr:** live WebRTC presence is shape-validated and bound to the Trystero transport `userId` only (no Ed25519 presence attestation). Nostr presence also carries `attestSig` over:

```
["tazep.presence.v4", roomId, userId, signPubKeySpkiB64, encPubKeyRawB64, atMs, alias, avatarSeed]
```

`atMs` must be within `LIVE_CLOCK_SKEW_MS` and **strictly increasing** per `userId` at the receiver. Attestation binds keys + alias + avatar to a claimed `userId` (first-writer TOFU). It does **not** equal Trystero WebRTC binding. Signing SPKI and X25519 enc are **pinned together**; a `changed` sign key does **not** update the enc key used for Susurros, and enc is not silently rotated under the same SPKI. WebRTC presence is preferred over Nostr when both exist for the same `userId`.

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
  type: 'NEW_THREAD' | 'REPLY' | 'DELETE_PROPOSE' | 'DELETE_VOTE';
  threadId: string;
  parentMsgId: string | null;
  title: string;
  body: string;
  createdAtMs: number;
  authorUserId: string;
  sig: string; // Ed25519 over canonical, base64 (IEEE P1363 / raw)
}
```

### Talk content vs delete ballot

| Type | Role |
| --- | --- |
| `NEW_THREAD` | Root of a bonfire (`parentMsgId` must be `null`; `body` non-empty) |
| `REPLY` | Reply (`parentMsgId` = parent `msgId`; `body` non-empty) |
| `DELETE_PROPOSE` / `DELETE_VOTE` | Ballot over a `threadId` — not shown as forum posts |

### Extinguish bonfire (unanimous tribe vote)

| Type | `parentMsgId` | `title` | `body` |
| --- | --- | --- | --- |
| `DELETE_PROPOSE` | `null` | `""` | Sorted unique online `userId`s (`localeCompare` `en`, comma-separated); must include author |
| `DELETE_VOTE` | propose `msgId` | `""` | `"aye"` |

Rules (source: [`threadDelete.ts`](../src/core/forum/threadDelete.ts), enforced in [`forumIngest.ts`](../src/core/p2p/forumIngest.ts) for remote **and** local publish):

1. **One propose per `threadId`** — further `DELETE_PROPOSE` are rejected. Only the **earliest** ballot can authorize a purge.
2. **Electorate cover (live / Nostr fallback)** — body must include every peer this receiver already considered online at `createdAtMs` (±2 s join skew: peers first seen after that may be omitted). Historical **sync** skips cover (tombstones already agreed elsewhere).
3. **Votes** — parent must exist as that primary `DELETE_PROPOSE`, matching `threadId`; author ∈ electorate. Orphan votes queue briefly for the parent, then drop.
4. **Completion** — proposer counts as aye. When every elector has voted aye, peers purge `NEW_THREAD` / `REPLY` for that `threadId`, keep `DELETE_*` tombstones, and omit talk content from sync snapshots ([`syncCoordinator.ts`](../src/core/p2p/syncCoordinator.ts)).

```
propose(onlineIds) → DELETE_PROPOSE
                  ↘ peers: cover check + store
vote → DELETE_VOTE (parent = propose)
    ↘ when |votes| == |electorate|: purge content, keep tombstones
```

UI: Forum → extinguish bonfire → confirm → progress banner until unanimous. Alone in the zone ⇒ propose completes immediately.

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

Room material: PBKDF2 210k once (salt `tazep.fallback.v2:{roomId}`) + dual HKDF (`tazep/room-key`, `tazep/topic`); blob **`0x03`** + AAD `tazep.fallback.aad.v3:{roomId}`; most envelopes `v: 2`.

| `t` | Fields | Auth |
| --- | --- | --- |
| `forum` (`v: 2`) | `event` | Ed25519 on event; ingest without live transport binding |
| `presence` (`v: 2`) | `userId`, `state`, `atMs`, `attestSig` | `tazep.presence.v4` |
| `goodbye` (`v: 2`) | `userId`, keys, `atMs`, `attestSig` | `tazep.goodbye.v3` |
| `dm` (`v: 2`, legacy) | `dm` | Same as Whisper wire; co-members see metadata after room decrypt |
| `dm-wrap` (`v: 3`) | `blobB64` only | **Nostr fallback only** (WebRTC Whispers stay `seal: 2`). Pairwise AES (HKDF `tazep/dm-wrap:{sortedUserIds}`) + AAD `tazep.dm-wrap.aad.v1:{roomId}`; publish upgrades `dm` → `dm-wrap`; receivers still accept legacy `dm` |
| `sync-req` (`v: 2`) | `fromUserId`, `reqId` | — |
| `sync-res` (`v: 2`) | `fromUserId`, `toUserId`, `reqId`, `events`, `eventsDigest`, `sig` | see below |

- EVENT: schnorr verify of canonical id + `created_at` skew **before** decrypt.
- `sync-res`: `eventsDigest = hex(SHA-256(JSON.stringify(events)))`; sig over  
  `["tazep.sync-res.v1", roomId, reqId, fromUserId, toUserId, eventsDigest]`.
  Valid replies are **merged** until the request timeout (not first-wins).
- Relays see metadata and ciphertext, not plaintext. Not true P2P.
- Phrase holders still decrypt the **room** layer; `dm-wrap` (fallback path only) hides Susurro metadata from co-members (timing/size still leak).

---

## Flow

```
publish → Ed25519_sign → forumIngest (same rules as remote) → forumMsg.send
                      ↘ onMessage: author==userId + verify(pinned) + delete guards

delete  → DELETE_PROPOSE / DELETE_VOTE (same forumMsg channel)
                      ↘ unanimous → purge content; sync keeps tombstones only

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
| Unanimous bonfire extinguish | [`src/core/forum/threadDelete.ts`](../src/core/forum/threadDelete.ts) |
| Ed25519 sign/verify + sync-res | [`src/core/crypto/messageSigning.ts`](../src/core/crypto/messageSigning.ts) |
| Presence / goodbye attest | [`src/core/crypto/presenceAttest.ts`](../src/core/crypto/presenceAttest.ts) |
| DM seal | [`src/core/crypto/dmCrypto.ts`](../src/core/crypto/dmCrypto.ts) |
| Passphrase | [`src/core/crypto/passphraseWords.ts`](../src/core/crypto/passphraseWords.ts) |
| Mesh | [`src/core/p2p/p2pRoom.ts`](../src/core/p2p/p2pRoom.ts) |
| Forum / DM ingest | [`src/core/p2p/forumIngest.ts`](../src/core/p2p/forumIngest.ts), [`src/core/p2p/dmIngest.ts`](../src/core/p2p/dmIngest.ts) |
| Sync snapshot (tombstones) | [`syncCoordinator.ts`](../src/core/p2p/syncCoordinator.ts) |
| Pinned verify cache | [`verifyKeyRegistry.ts`](../src/core/p2p/verifyKeyRegistry.ts) |
| Nostr fallback | [`nostrFallback.ts`](../src/core/p2p/nostrFallback.ts), [`roomCrypto.ts`](../src/core/p2p/roomCrypto.ts), [`fallbackBridge.ts`](../src/core/p2p/fallbackBridge.ts) |
| Multi-zone | [`src/hooks/useRoomManager.ts`](../src/hooks/useRoomManager.ts) |
| Papers | [`papers/`](papers/) |

---

## Sync roadmap

Today: signed-event merge + snapshot RPC (WebRTC + signed Nostr `sync-res`). Eventual typed sync (e.g. CRDT) is future — it does not replace Ed25519 authorship signatures. MLS / KT remain out of scope for ephemeral `identity: 'none'` hosting.
