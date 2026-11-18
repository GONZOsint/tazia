# TAZIA

**Temporary Anonymous Zone In Action**

Live temporary zone in the browser: no accounts, no message server of ours. Share a phrase, talk while everyone is online, **burn the session** when done. On phones you can **Install / Add to Home Screen** (PWA) for an app-like shell — the plaza still needs the network and live peers.

Stack: [React](https://react.dev/) + [Vite](https://vite.dev/) + [Trystero 0.27](https://trystero.dev/). Protocol: `agora-forum-v1` (Ed25519-signed events). App ID: `tazia.app`.

Spanish README: [`README.es.md`](README.es.md).

## Quick start

1. Open the site (local or static host).
2. **Open a zone** and generate a memorable phrase.
3. Say the phrase in person / on paper. Optional: put it in the `#` link (riskier).
4. Share link or QR (QR is generated **in the browser**; you can also **scan** a QR to join).
5. First join asks for **network address consent**.
6. When done: **Burn session**.

You must be **online at the same time**. No async mailbox.

### Features

- **Several zones at once** (up to **5**): each keeps its own live P2P session; **Zones** lists them; switch or leave one; Plaza / Tribe / Whispers show the **active** zone; **Burn** clears all on this device
- Whispers (signed, targeted DMs) scoped to the active zone
- TOFU trust + 4-emoji safety codes (Tribe)
- Optional self-hosted TURN (ICE fallback / hide IP) — see [`TURN.md`](TURN.md)

### Several zones

Join zone A, then open or enter zone B without dropping A (wait until the first join finishes). Use **Switch** on the Zones list. Leave removes only that zone; Burn nukes every zone on this browser. Mesh works best with a small group (~5 peers).

### ICE failed / CGNAT / same Wi‑Fi on Pages

If Firefox shows `WebRTC: ICE failed, add a TURN server`, STUN alone cannot punch through your NAT (common on residential CGNAT). Options:

1. Meet on the **same Wi‑Fi** (host / mDNS candidates) — on GitHub Pages, allow **Local network** if Chrome asks; disable AP/client isolation; leave **Force relay** off.
2. Run your own **coturn** and enable TURN under Zones (both peers need it).

JS-side helpers: `iceCandidatePoolSize`, Trystero `turnConfig`, LNA priming, and an **encrypted Nostr data-plane fallback** when ICE fails so chat still works on Pages without TURN (not true P2P; relays see ciphertext). Self-hosted TURN remains the path for a real mesh. Details: [`TURN.md`](TURN.md).

## Development

```bash
npm install
npm run dev
```

| Script | What |
| --- | --- |
| `npm run build` | Static build → `dist/` |
| `npm run preview` | Serve build |
| `npm run lint` | `tsc --noEmit` |

For LAN testing, Vite listens on all interfaces (`host: true`). On Windows, allow `node.exe` or TCP `5173` in the firewall if the network profile is **Public**. Dev URL: `http://localhost:5173/tazia/`.

## Docs

- [`SECURITY.md`](SECURITY.md) — threat model, TOFU, CSP, honest limits. Spanish.
- [`PROTOCOL.md`](PROTOCOL.md) — `agora-forum-v1` wire format. Spanish.
- [`TURN.md`](TURN.md) — self-hosted coturn + ICE failed checklist.

## Papers / readings

| Source | Relevance |
| --- | --- |
| [Cwtch](https://cwtch.im/cwtch.pdf) / [docs](https://docs.cwtch.im/) | Untrusted infra + failure detection |
| [AW CCS’25 / ePrint 2025/1619](https://eprint.iacr.org/2025/1619) | Metadata hiding (not implemented) |
| [WebRTC IP leakage 2025](https://arxiv.org/abs/2510.16168) + [RFC 8828](https://www.rfc-editor.org/rfc/rfc8828.html) | IP consent UX |
| [ePrint 2026/584](https://eprint.iacr.org/2026/584.pdf) | Do not treat DTLS alone as authorship |
| [ePrint 2025/1598](https://eprint.iacr.org/2025/1598) SAS + OOB | Validates emoji verify; we use 4 emoji (~24 bit) — longer SAS is roadmap |
| [RFC 8826](https://datatracker.ietf.org/doc/html/rfc8826) | WebRTC security; TOFU weak without OOB |
| [arXiv:2510.27500](https://arxiv.org/html/2510.27500) DCUtR NAT | Hole-punch ~70%; TURN still needed as fallback |
| [arXiv:2311.04658](https://arxiv.org/html/2311.04658v2) CGNAT | Why residential ICE fails without TURN |
| [SnoW serverless n-party WebRTC](https://arxiv.org/pdf/2206.12762) | Full mesh degrades beyond ~4–6 peers — keep zones small |
| [CRDT P2P WebRTC VR](https://arxiv.org/html/2503.17826v1) | Eventual typed sync over data channels (future; we use signed merge today) |
| [Delta Chat realtime P2P](https://delta.chat/en/2024-11-20-webxdc-realtime) | Ephemeral side channels — several independent zones fit that model |
| [Chrome LNA](https://developer.chrome.com/blog/local-network-access) | Public origin → LAN permission (same Wi‑Fi on Pages) |
| [WebTransport](https://developer.chrome.com/docs/capabilities/web-apis/webtransport) | Client–server only — not a P2P mesh substitute |
| OpenMLS / WASM | Future groups roadmap |

**Browsers:** Chrome, Brave, Firefox, and Safari (HTTPS). Ed25519 uses native Web Crypto when present, otherwise `@noble/ed25519`. Brave’s stricter WebRTC IP policy and Safari’s hidden host ICE candidates can hurt same-LAN mesh — TURN or the encrypted Nostr fallback cover that. Keep **Trystero**; do not fork Nostr/Trystero for Pages.

## GitHub Pages

Live site: `https://gonzosint.github.io/tazia/` (`base: '/tazia/'` in Vite). [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) builds `dist/` and publishes it to the `gh-pages` branch on every push to `master`.

Do not serve the source `index.html` as-is — a production build is required.

## Deploy headers

See [`public/_headers`](public/_headers) (Netlify-style). Prefer HTTP CSP over meta; fonts are self-hosted. `frame-ancestors` only works as an HTTP header (GitHub Pages does not apply `_headers`).
