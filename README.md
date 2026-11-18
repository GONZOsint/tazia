# TAZIA

**Temporary Anonymous Zone In Action** / **Zona Anónima Temporal en Acción**

Live temporary chat in the browser: no accounts, no message server of ours. Share a phrase, talk while everyone is online, leave the tab when done.

Charla temporal en el navegador: sin cuentas ni servidor nuestro de mensajes. Comparte una frase, hablad mientras estéis online, salid al acabar.

Stack: [React](https://react.dev/) + [Vite](https://vite.dev/) + [Trystero 0.27](https://trystero.dev/). Protocol: `agora-forum-v1` (Ed25519-signed events). App ID: `tazia.app`.

## Quick start / Uso rápido

1. Open the site (local or static host).
2. **Create room** and generate a memorable phrase.
3. Say the phrase in person / on paper. Optional: put it in the `#` link (riskier).
4. Share link or QR (QR is generated **in the browser**).
5. First join asks for **network address consent**.
6. When done: **Leave this tab**.

You must be **online at the same time**. No async mailbox.

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

## Docs

- [`SECURITY.md`](SECURITY.md) — threat model, CSP, no-goals (Tor/MLS).
- [`PROTOCOL.md`](PROTOCOL.md) — `agora-forum-v1` wire format.

## Papers / readings

| Source | Relevance |
| --- | --- |
| [Cwtch](https://cwtch.im/cwtch.pdf) / [docs](https://docs.cwtch.im/) | Untrusted infra + failure detection |
| [AW CCS’25 / ePrint 2025/1619](https://eprint.iacr.org/2025/1619) | Metadata hiding (not implemented) |
| [WebRTC IP leakage 2025](https://arxiv.org/abs/2510.16168) + [RFC 8828](https://www.rfc-editor.org/rfc/rfc8828.html) | IP consent UX |
| [ePrint 2026/584](https://eprint.iacr.org/2026/584.pdf) | Do not treat DTLS alone as authorship |
| OpenMLS / WASM | Future groups roadmap |

## Deploy headers

See [`public/_headers`](public/_headers) (Netlify-style). Prefer HTTP CSP over meta; fonts are self-hosted.
