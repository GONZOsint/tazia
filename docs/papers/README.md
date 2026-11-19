# Papers (local cache)

PDFs are downloaded for offline reading during security/perf work. They are **gitignored** (`docs/papers/*.pdf`).

| Local file | Source | Notes for TAZIA | Status |
| --- | --- | --- | --- |
| `eprint-abstracts.md` | ePrint 2026/584, 2025/1598, 2025/554, 2025/1619 | DTLS≠auth, SAS, signcryption binding, AW | Abstracts (CDN 403 on PDF) |
| `arxiv-2206.12762-snow.pdf` | [SnoW](https://arxiv.org/abs/2206.12762) | Mesh degrades ~4–6 peers | Downloaded |
| `arxiv-2510.16168-webrtc-ip.pdf` | [arXiv:2510.16168](https://arxiv.org/abs/2510.16168) | WebRTC IP leakage | Downloaded |
| `arxiv-2510.27500-dcutr.pdf` | [arXiv:2510.27500](https://arxiv.org/abs/2510.27500) | NAT hole-punch rates | Downloaded |
| `arxiv-2311.04658-cgnat.pdf` | [arXiv:2311.04658](https://arxiv.org/abs/2311.04658) | CGNAT / ICE failures | Downloaded |
| `arxiv-2503.17826-crdt.pdf` | [arXiv:2503.17826](https://arxiv.org/abs/2503.17826) | CRDT sync (future) | Downloaded |
| `cwtch.pdf` | [Cwtch](https://cwtch.im/cwtch.pdf) | Untrusted infra model | Downloaded |

## Re-download

```powershell
# From repo root (User-Agent needed for ePrint 403s)
curl.exe -fsSL -A "Mozilla/5.0" -o docs/papers/eprint-2026-584.pdf https://eprint.iacr.org/2026/584.pdf
```
