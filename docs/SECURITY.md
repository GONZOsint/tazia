# Security — TAZIA

English · [Español](SECURITY.es.md)

How TAZIA thinks about security: who can see what, what it mitigates today, and what it does **not** promise.

Message format: [`PROTOCOL.md`](PROTOCOL.md). Connection / TURN: [`TURN.md`](TURN.md). Papers: [`papers/`](papers/).  
Protocol: **TAZEP** `tazep-v2` · app: `tazia.app`.

---

## What it is (and is not)

TAZIA is a **live assembly**. The group shares a phrase, builds a peer-to-peer WebRTC mesh (via Trystero), and talks while tabs stay open.

It is not an async messenger (“leave a message, read it later”), not Tor, and there is no trusted server storing the chat. When nobody else is online, the room goes quiet.

---

## Who can see what

| Actor | Assumed capabilities |
| --- | --- |
| Anyone who knows the phrase | Joins the zone, publishes, requests or serves sync |
| Malicious peer *inside* the zone | Can lie in local UI; must not forge others’ signed history |
| Public Nostr relay operator | Sees encrypted signaling; with the data-plane fallback, also AES-GCM ciphertext (encrypted bytes, not plaintext) |
| Network / STUN observer | Can see WebRTC participant IPs |
| TURN operator (if configured) | Sees IP and encrypted WebRTC traffic; cannot forge app signatures |
| Static hosting | Serves JS/CSS; does not store messages |

---

## What protects you today

### Zone access

The **phrase** is the key: Trystero derives discovery-handshake encryption from it. Without the phrase there is no useful mesh. Default is **6 Spanish words** (~48 bits; 256-term wordlist in `passphraseWords.ts`). Create/join require an acceptable phrase (score ≥ good). Up to **3** concurrent zones; soft cap **50** peers per zone (`MAX_USERS`).

### Identity

Each tab/zone is a new `userId` (`identity: 'none'`). **Burn session** closes all local meshes on this device.

### Deleting a talk (tribe vote)

There is no unilateral “delete message”. In Plaza, proposing to delete a talk freezes the electorate (online tribe at that moment) and requires a **unanimous aye** (`DELETE_PROPOSE` / `DELETE_VOTE` in [`PROTOCOL.md`](PROTOCOL.md)).

- The proposer counts as aye; alone in the zone, delete completes immediately.
- Peers reject proposes that **shrink** the electorate relative to who they already saw online (blocks “delete without the others”).
- One propose per talk; on completion, `NEW_THREAD` / `REPLY` are purged and signed tombstones remain (sync must not resurrect content).
- **Not** the same as burn: the vote removes that talk on peers that apply the quorum; burn forgets **every** zone on **this** device.

Rule details: [`threadDelete.ts`](../src/core/forum/threadDelete.ts).

### Live messages (WebRTC)

A `forumMsg` is accepted only if `authorUserId` matches the peer’s Trystero `userId`. DTLS does **not** count as authorship ([ePrint 2026/584](https://eprint.iacr.org/2026/584)).

**Whispers** are sealed-only (`seal: 2`) with AAD `tazep.dm.aad.v2:…`. Joining a zone **requires** SubtleCrypto X25519 in the browser; if missing, join fails (no polyfill). Plaintext does not travel on the wire.

### When WebRTC cannot connect (Nostr fallback)

If ICE fails, chat can continue over **encrypted** Nostr relays (PBKDF2 210k + HKDF `tazep/*`; blob `0x03` + AAD `tazep.fallback.aad.v3:{roomId}`; envelope `v: 2`).

Binding there is application-level, not transport: forum messages are accepted with Ed25519 and the **pinned** key registry (no fake `liveUserId`). Presence requires a signed attestation over `["tazep.presence.v3", …, atMs, alias]` (±5 min clock, strictly increasing `atMs`) before TOFU pin. Goodbye is attested; `sync-res` is signed (WebRTC sync too) and merged until timeout; EVENT clock skew is checked; `schnorr.verify` runs **before** decrypt. Fallback rate limits (forum, DM, sync, presence/goodbye) use the Nostr EVENT pubkey, not only the claimed `userId`.

Attestation binds sign+enc keys to a claimed `userId` (first writer wins the TOFU pin). A `changed` sign key does **not** redirect Susurro enc. WebRTC presence is preferred over Nostr for the same `userId`. It does **not** equal Trystero WebRTC binding. Relays see metadata and encrypted bytes — not true P2P.

### Sync and signatures

Every event carries an **Ed25519** signature over the canonical payload. Verify uses the **pinned** SPKI until an explicit `repin`. Snapshots without a valid signature or known key are **dropped**.

Clock skew: live forum + Whispers ±5 min; historical sync ±24 h; Nostr EVENT ±300 s.  
Soft rate limits: 30 publishes/min/peer, 30 Whispers/min, 12 sync answers/min; WebRTC sync sampled to 8 peers. Sync answers > 2 MB are rejected (`maxReceiveBytes` ≈ 2.5 MB).

### Trust between people

**WebRTC:** the first key seen is pinned (TOFU: *trust on first use*) after validated Trystero presence (transport-bound ingest).  
**Nostr:** pin only after attested presence.  
Safety code (SAS): **6** emojis from a **256**-symbol pool (~48 bits) + `roomId` binding, from pinned SPKI **and** X25519 keys ([ePrint 2025/1598](https://eprint.iacr.org/2025/1598)). Key rotation → `changed`; verify stays on the pinned key until an explicit `repin` (no silent auto-heal). A `changed` sign key does **not** redirect Susurro enc keys.

### Network, consent, and burn

IP consent on first use. Burn does **not** clear it; “Forget this device” does.  
Phrase in the URL is scrubbed (`public/scrub-phrase.js` + React).  
Optional TURN: `sessionStorage` by default; `localStorage` only with opt-in. Burn clears sessionStorage, **not** remembered TURN. Details: [`TURN.md`](TURN.md).  
CSP / fonts: meta CSP in `index.html` (active on GitHub Pages). [`../public/_headers`](../public/_headers) is a sample for hosts that honor headers (Netlify/CF); Pages does **not** apply `_headers`, so `frame-ancestors` / `X-Frame-Options` are not present on the default github.io deploy.

**Burn session** closes meshes, clears trust, wipes refs, `sessionStorage.clear`, and reloads. It is **not** forensic secure delete or practical deniability ([PoPETs 2025](https://petsymposium.org/popets/2025/popets-2025-0018.pdf)).

---

## Honest limits

- **Strong anonymity** — WebRTC leaks IP (sometimes LAN via mDNS). We do not pretend otherwise ([arXiv:2510.16168](https://arxiv.org/abs/2510.16168), [RFC 8828](https://www.rfc-editor.org/rfc/rfc8828.html)).
- **CGNAT without TURN** — STUN often fails behind residential CGNAT ([arXiv:2311.04658](https://arxiv.org/html/2311.04658v2), [arXiv:2510.27500](https://arxiv.org/html/2510.27500)). GitHub Pages does not serve TURN.
- **Anonymity Wrappers** — [ePrint 2025/1619](https://eprint.iacr.org/2025/1619) not implemented.
- **DTLS as authorship proof** — no ([ePrint 2026/584](https://eprint.iacr.org/2026/584.pdf)). DTLS ≠ E2E for Whispers.
- **Practical deniability** — we do not claim it. Ed25519 signatures are attributable; burn clears this tab, not other devices or relays.
- **Burn ≠ secure delete** — non-extractable `CryptoKey`s cannot be zeroized; reload reduces tab RAM surface.
- **Delete vote ≠ global guarantee** — a peer that never received the completed ballot may still show the talk; there is no server that forces erasure everywhere.
- **MLS / Double Ratchet / Key Transparency** — need durable identity or a log operator; incompatible with `identity: 'none'` + pure static hosting ([RFC 9420](https://www.rfc-editor.org/rfc/rfc9420)).
- **Tor** — out of scope.
- **Wake Lock** — optional; keeps the screen on, does not stop iOS from killing WebRTC when backgrounded.

---

## Deployment

- Static hosting: `npm run build` → `dist/`.
- Single HTML: `npm run build:single` → `release/tazia-single.html` + `.sha256` (verifiable build; how to open it: [`README.md`](../README.md)). Does not replace the multi-asset Pages deploy.
- SDP/QR spike: [`sdp-qr-spike.md`](sdp-qr-spike.md) — not in the app; does not replace Trystero.

Suggested headers:

```
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' wss:; worker-src 'self' blob:;
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(self), microphone=(), geolocation=(), local-network=(self), loopback-network=(self)
```

Nostr relays use `wss:`; `https:` is not required in `connect-src` for the mesh.

**Same Wi‑Fi from Pages.** The origin is public, so Chrome may ask for **Local network** permission. On join, TAZIA prepares ICE (network candidates) and keeps `iceTransportPolicy: 'all'` unless you force relay-only. Router client isolation or a denied LNA permission blocks LAN even when TURN is unnecessary.

**Scale.** Mesh degrades around 4–6 peers ([SnoW](https://arxiv.org/pdf/2206.12762)); soft cap 50, warn from 6.

---

## Browsers and APIs

Stack: **Trystero** (WebRTC + Nostr signaling). Target: Chrome, Brave, Firefox, and Safari (desktop + iOS) on HTTPS / localhost.

| Browser | Note |
| --- | --- |
| Chrome | Stable WebRTC; LNA (*Local network*, 142+) helps same Wi‑Fi from a public origin. Native Ed25519 from **137**; else → `@noble/ed25519`. |
| Brave | Same engine; *WebRTC IP Handling* can hide host candidates and worsen LAN mesh. More obfuscation ≠ better P2P. |
| Firefox | Solid WebRTC; no LNA API. Native Ed25519 from **129**. Desktop obfuscates host via mDNS. |
| Safari | WebRTC since 11; Ed25519 from **17**. By default hides host ICE until capture permission (TAZIA does not ask for mic/cam) — same Wi‑Fi often needs TURN or Nostr fallback. |
| Tor | Out of scope |

### API compatibility

| API | Use | Chrome / Brave | Firefox | Safari |
| --- | --- | --- | --- | --- |
| `RTCPeerConnection` / DataChannel | Mesh | Yes | Yes | Yes (11+) |
| `permissions` `local-network` | LNA priming | Yes (recent Chromium) | No | No |
| `SubtleCrypto` AES-GCM / PBKDF2 / SHA-256 | Phrase + fallback | Yes | Yes | Yes |
| `SubtleCrypto` Ed25519 | Signatures + attest | 137+; else → noble | 129+; else → noble | 17+; else → noble |
| `WebSocket` (`wss:`) | Signaling / fallback | Yes | Yes | Yes |
| `navigator.clipboard.writeText` | Copy invite | Yes | Yes | Yes (gesture); fallback `execCommand` |
| `getUserMedia` + QR | Scan invite | Yes | Yes | Yes (HTTPS + gesture) |
| `localStorage` / `sessionStorage` | Consent, theme, TURN | Yes | Yes | Yes |
| Screen Wake Lock | Keep screen on | Yes | Yes | Partial |
| `SubtleCrypto` X25519 | Whisper — **required** | Recent; if missing → **join fails** | Recent | Recent |

WebRTC remains the peer-to-peer API. WebTransport is client↔server; it does not replace a browser mesh. Realistic hole-punch ~70%; the rest needs TURN ([arXiv:2510.27500](https://arxiv.org/html/2510.27500)).
