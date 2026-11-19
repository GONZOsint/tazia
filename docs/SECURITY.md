# Security — TAZIA

English · [Español](SECURITY.es.md)

Threat model and mitigations for the TAZIA P2P forum (**TAZEP** `tazep-v2`, `APP_ID=tazia.app`). Wire format: [`PROTOCOL.md`](PROTOCOL.md). TURN / ICE: [`TURN.md`](TURN.md). Local papers: [`papers/`](papers/).

## What it is (and is not)

**TAZIA** (*Temporary Anonymous Zone In Action*) is a **live assembly**: the group shares a phrase, builds a WebRTC mesh (Trystero), and talks while tabs stay open. It is not an async messenger, not Tor, and not a trusted server.

## Actors

| Actor | Assumed capabilities |
| --- | --- |
| Band member (knows the phrase) | Joins the zone, publishes, requests/serves sync |
| Malicious peer *inside* the zone | Can lie in local UI; must not forge others’ signed history |
| Public Nostr relay operator | Sees encrypted signaling; with data-plane fallback, also AES-GCM ciphertext (not plaintext) |
| Network / STUN observer | Can see WebRTC participant IPs |
| TURN operator (if configured) | Sees IP and encrypted WebRTC traffic; cannot forge app signatures |
| Static hosting | Serves JS/CSS; does not store messages |

## Current mitigations

1. **Zone phrase** — Trystero derives discovery-handshake encryption (`password`). Without the phrase there is no useful mesh. Default memorable **6 Spanish words** (~48 bits; wordlist of 256 unique terms in `passphraseWords.ts`); create/join require `isAcceptable` (score ≥ good). Up to **3** concurrent zones; soft cap **50** peers/zone (`MAX_USERS`).
2. **Ephemeral identity** — `identity: 'none'`: each tab/zone is a new `userId`; **burn session** closes all local meshes.
3. **Live authorship (WebRTC)** — `forumMsg` is accepted only if `authorUserId` matches the peer’s Trystero `userId`. DTLS does **not** count as authorship ([ePrint 2026/584](https://eprint.iacr.org/2026/584)).
4. **Nostr fallback — app binding** — Forum ingest with **no** fake `liveUserId` (Ed25519 + **pinned** registry only). Nostr presence requires Ed25519 **attestation** over `["tazep.presence.v1", …]` before TOFU pin. Attestation binds keys to a claimed `userId` (first-writer TOFU); it does **not** equal Trystero WebRTC binding. Goodbye attested; `sync-res` signed; EVENT `created_at` skew-checked; schnorr.verify before decrypt.
5. **Verifiable sync** — Every event carries an **Ed25519** signature over the canonical payload. Verify uses the **pinned** SPKI until explicit `repin`. Snapshots without a valid signature or known key are **dropped**.
6. **Clock** — live forum + DMs ±5 min; historical sync ±24 h; Nostr EVENT ±300 s.
7. **Soft rate limits** — Max 30 publishes/minute per peer (live/fallback/sync); max 30 Whispers/minute; max 12 sync answers/minute; WebRTC sync sampled to 8 peers.
8. **Sync size limit** — sync answers > 2 MB are rejected (`MAX_SYNC_TOTAL_BYTES`); Trystero `maxReceiveBytes` ≈ 2.5 MB.
9. **TOFU + emoji SAS** — **WebRTC:** pin after validated Trystero presence (transport-bound live ingest). **Nostr:** pin only after attested presence. SAS: **6** emojis from a **256-symbol unique** pool (~48 bits) + `roomId` binding, derived from **pinned** SPKIs ([ePrint 2025/1598](https://eprint.iacr.org/2025/1598)). Key rotation → `changed`; verify stays on pinned until `repin` (no silent auto-heal).
10. **IP consent** — Modal on first use. Burn does **not** clear consent; “Forget this device” does.
11. **Phrase scrub in URL** — `public/scrub-phrase.js` + React.
12. **Optional TURN** — STUN by default; credentials in **sessionStorage** (localStorage only with opt-in). Burn clears sessionStorage but **not** opted-in TURN localStorage. See [`TURN.md`](TURN.md).
13. **CSP / fonts** — Meta CSP + [`../public/_headers`](../public/_headers).
14. **Encrypted Nostr fallback** — PBKDF2 210k (once) + dual HKDF (`tazep/*`); blob **only** `0x03` + AAD `tazep.fallback.aad.v3:{roomId}`; envelope `v: 2`.
15. **Whispers** — **sealed-only** (`seal: 2`); AAD `tazep.dm.aad.v2:…` ([ePrint 2025/554](https://eprint.iacr.org/2025/554)); join **requires SubtleCrypto X25519** (no noble polyfill — join fails if unavailable); no plaintext on the wire.
16. **Burn session** — closes meshes, clears trust, wipes noble + enc refs, `sessionStorage.clear`, reload. **Not** forensic secure delete nor practical deniability ([PoPETs 2025](https://petsymposium.org/popets/2025/popets-2025-0018.pdf)).

## Honest limits (no-goals)

- **Strong metadata / anonymity** — WebRTC leaks IP (and sometimes LAN via mDNS). We do not pretend otherwise; see [arXiv:2510.16168](https://arxiv.org/abs/2510.16168) and [RFC 8828](https://www.rfc-editor.org/rfc/rfc8828.html).
- **CGNAT without TURN** — STUN often fails behind residential CGNAT ([arXiv:2311.04658](https://arxiv.org/html/2311.04658v2), [arXiv:2510.27500](https://arxiv.org/html/2510.27500)). GitHub Pages does not serve TURN.
- **Anonymity Wrappers** — [AW CCS’25 / ePrint 2025/1619](https://eprint.iacr.org/2025/1619) **not** implemented.
- **Blind trust in DTLS-SRTP** — [ePrint 2026/584](https://eprint.iacr.org/2026/584.pdf); we keep Trystero identity + app signatures. DTLS ≠ E2E for person-to-person Whispers.
- **Practical deniability** — We do not claim it. Local Ed25519 event signatures are attributable in practice; burn clears the tab, not evidence on other devices or relays ([PoPETs 2025 deniability](https://petsymposium.org/popets/2025/popets-2025-0018.pdf)).
- **Burn ≠ secure delete** — non-extractable `CryptoKey`s cannot be zeroized; reload reduces tab RAM surface.
- **MLS / OpenMLS / Double Ratchet / Key Transparency** — need durable identity and/or a log operator; incompatible with `identity: 'none'` + pure static hosting. Distant roadmap, not this cycle ([RFC 9420](https://www.rfc-editor.org/rfc/rfc9420), [KT draft](https://datatracker.ietf.org/doc/html/draft-ietf-keytrans-architecture-05)).
- **Untrusted infra like Cwtch** — design inspiration, without their transport stack.
- **Tor** — out of scope.
- **Wake Lock** — optional; keeps the screen on, does **not** stop iOS from killing WebRTC when backgrounded.

## Deployment

- Static hosting (`npm run build` → `dist/`).
- **Single-file (P3):** `npm run build:single` → `release/tazia-single.html` + `.sha256` (verifiable artifact; does not replace default multi-asset Pages).
- Manual SDP/QR spike: [`sdp-qr-spike.md`](sdp-qr-spike.md) (not shipped; does not replace Trystero).
- Suggested headers (in addition to or instead of meta CSP):

```
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' wss:; worker-src 'self' blob:;
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(self), microphone=(), geolocation=(), local-network=(self), loopback-network=(self)
```

Trystero’s Nostr relays use `wss:`; `https:` is not required in `connect-src` for the mesh.

**Same LAN from GitHub Pages:** the origin is public (`https://…github.io`), so Chrome may ask for **Local network** (`local-network`) for host/mDNS candidates. TAZIA primes ICE on join and keeps `iceTransportPolicy: 'all'` unless force-relay. AP/client isolation or denied LNA blocks LAN even when TURN is unnecessary.

**Nostr fallback (Pages / CGNAT):** chat/presence/DM over AES-GCM Nostr (separate Ed25519 signature + presence attestation + EVENT verify). Relays see metadata and ciphertext. Not true P2P. Mesh degrades ~4–6 peers ([SnoW](https://arxiv.org/pdf/2206.12762)); soft cap 50, warn from 6.

## Browsers and APIs (SOTA)

Stack: **Trystero** (WebRTC + Nostr signaling). Do not fork Trystero/Nostr or migrate to js-libp2p on pure static hosting.

Target support: **Chrome**, **Brave**, **Firefox**, **Safari** (desktop + iOS WebKit) in a secure context (HTTPS / localhost).

| Browser | Note for TAZIA |
| --- | --- |
| Chrome | Stable WebRTC + DataChannel; LNA (*Local network*, Chrome 142+) helps same Wi‑Fi from a public origin ([Chrome LNA](https://developer.chrome.com/blog/local-network-access)). Native Ed25519 in SubtleCrypto from **137** ([Can I use](https://caniuse.com/mdn-api_subtlecrypto_generatekey_ed25519)); TAZIA uses `@noble/ed25519` if missing. |
| Brave | Same Chromium/WebRTC engine; *WebRTC IP Handling* policy can hide host candidates and worsen LAN mesh ([Brave WebRTC settings](https://github.com/brave/brave-browser/wiki/WebRTC-Custom-Settings)). More obfuscation ≠ better P2P ([arXiv:2510.16168](https://arxiv.org/abs/2510.16168)). |
| Firefox | Solid WebRTC; no LNA API. Native Ed25519 from **129**. Desktop obfuscates host via mDNS; `about:webrtc` for diagnostics. |
| Safari | WebRTC since 11; native Ed25519 from **17**. By default **hides host ICE** until capture permission (TAZIA does not ask for mic/cam) — same Wi‑Fi often needs TURN or encrypted Nostr fallback. Clipboard/`getUserMedia` need a stricter user gesture on iOS. |
| Tor | Out of scope; blocks WebRTC leaks but is not TAZIA’s model |

### APIs used and compatibility

| API | Use in TAZIA | Chrome / Brave | Firefox | Safari |
| --- | --- | --- | --- | --- |
| `RTCPeerConnection` / DataChannel | Trystero mesh | Yes ([Can I use RTCPeerConnection](https://caniuse.com/rtcpeerconnection)) | Yes | Yes (11+) |
| `permissions` `local-network` | LNA priming | Yes (recent Chromium) | No | No |
| `SubtleCrypto` AES-GCM / PBKDF2 / SHA-256 | Room phrase + Nostr fallback | Yes | Yes | Yes |
| `SubtleCrypto` Ed25519 | Authorship signatures + presence attest | 137+; else → `@noble/ed25519` | 129+; else → noble | 17+; else → noble |
| `WebSocket` (`wss:`) | Signaling / Nostr fallback | Yes | Yes | Yes |
| `navigator.clipboard.writeText` | Copy invite | Yes | Yes | Yes (gesture); fallback `execCommand` |
| `getUserMedia` + QR (`cam2qr`) | Scan invite | Yes | Yes | Yes (HTTPS + gesture; `playsInline`) |
| `localStorage` / `sessionStorage` | IP consent, theme; TURN (session by default) | Yes | Yes | Yes |
| Screen Wake Lock | Keep screen on (optional) | Yes | Yes | Partial |
| `SubtleCrypto` X25519 | Pairwise Whisper — **required** on join | Recent; if missing → **join fails** (no noble polyfill) | Recent | Recent |

- **WebRTC** remains the peer-to-peer API ([W3C WebRTC](https://www.w3.org/TR/webrtc), [RFC 8826](https://datatracker.ietf.org/doc/html/rfc8826)).
- **WebTransport** is client↔server HTTP/3; it does not replace a browser mesh ([Chrome WebTransport](https://developer.chrome.com/docs/capabilities/web-apis/webtransport)).
- Realistic hole-punch ~70%; the rest needs TURN ([arXiv:2510.27500](https://arxiv.org/html/2510.27500)).
