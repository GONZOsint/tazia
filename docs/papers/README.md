# Papers

English · [Español](README.es.md)

Papers and RFCs used while designing TAZIA. PDFs can be kept here for offline reading; they are **gitignored** (`docs/papers/*.pdf`) and are not part of the published repo.

| Local file | Source | What it means for TAZIA | Status |
| --- | --- | --- | --- |
| `eprint-abstracts.md` | ePrint 2026/584, 2025/1598, 2025/554, 2025/1619 | DTLS≠auth, SAS, signcryption binding, AW | Abstracts (CDN 403 on PDF) |
| — | [ePrint 2026/584](https://eprint.iacr.org/2026/584) | DTLS ≠ app authorship → Trystero live binding + Ed25519 | **Applied** (WebRTC); Nostr uses presence attest + signed ingest |
| — | [ePrint 2025/554](https://eprint.iacr.org/2025/554) | AAD binding for Whispers `seal:2` + fallback blob | **Applied** (DM + fallback); forum canonical still omits `roomId` |
| — | [ePrint 2025/1598](https://eprint.iacr.org/2025/1598) | SAS emoji TOFU | **Applied**; attested presence = Nostr path; WebRTC uses Trystero binding |
| — | [PoPETs 2025 deniability](https://petsymposium.org/popets/2025/popets-2025-0018.pdf) | Practical deniability hard; burn ≠ secure delete | **Documented** as no-goal in [`SECURITY.md`](../SECURITY.md) |
| — | [ePrint 2025/1619](https://eprint.iacr.org/2025/1619) | Anonymity Wrappers | **Not applied** (no-goal) |
| — | [RFC 9420 MLS](https://www.rfc-editor.org/rfc/rfc9420) / KT | Group ratchet + key transparency | **Not applied** — needs durable identity / log operator |
| `arxiv-2206.12762-snow.pdf` | [SnoW](https://arxiv.org/abs/2206.12762) | Mesh degrades ~4–6 peers | Downloaded |
| `arxiv-2510.16168-webrtc-ip.pdf` | [arXiv:2510.16168](https://arxiv.org/abs/2510.16168) | WebRTC IP leakage | Downloaded |
| `arxiv-2510.27500-dcutr.pdf` | [arXiv:2510.27500](https://arxiv.org/abs/2510.27500) | NAT hole-punch rates | Downloaded |
| `arxiv-2311.04658-cgnat.pdf` | [arXiv:2311.04658](https://arxiv.org/abs/2311.04658) | CGNAT / ICE failures | Downloaded |
| `arxiv-2503.17826-crdt.pdf` | [arXiv:2503.17826](https://arxiv.org/abs/2503.17826) | CRDT sync (future) | Downloaded |
| `cwtch.pdf` | [Cwtch](https://cwtch.im/cwtch.pdf) | Untrusted infra model | Downloaded |

## Re-download

From the repo root (User-Agent needed for ePrint 403s):

```powershell
curl.exe -fsSL -A "Mozilla/5.0" -o docs/papers/eprint-2026-584.pdf https://eprint.iacr.org/2026/584.pdf
curl.exe -fsSL -A "Mozilla/5.0" -o docs/papers/popets-2025-0018.pdf https://petsymposium.org/popets/2025/popets-2025-0018.pdf
```
