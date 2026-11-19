# Papers (caché local)

Español · [English](README.md)

Los PDF se descargan para lectura offline durante trabajo de seguridad/rendimiento. Están en **gitignore** (`docs/papers/*.pdf`).

| Archivo local | Fuente | Notas para TAZIA | ¿Aplicado? |
| --- | --- | --- | --- |
| `eprint-abstracts.es.md` | ePrint 2026/584, 2025/1598, 2025/554, 2025/1619 | DTLS≠auth, SAS, binding de signcryption, AW | Abstracts (CDN 403 en PDF) |
| — | [ePrint 2026/584](https://eprint.iacr.org/2026/584) | DTLS ≠ autoría de app → binding en vivo Trystero + Ed25519 | **Aplicado** (WebRTC); Nostr usa attestation de presence + ingest firmado |
| — | [ePrint 2025/554](https://eprint.iacr.org/2025/554) | Binding AAD para Susurros `seal:2` + blob fallback | **Aplicado** (DM + fallback Nostr); canonical de foro aún sin `roomId` |
| — | [ePrint 2025/1598](https://eprint.iacr.org/2025/1598) | SAS emoji TOFU | **Aplicado**; “presence atestiguada” = path **Nostr**; WebRTC usa binding Trystero |
| — | [PoPETs 2025 deniability](https://petsymposium.org/popets/2025/popets-2025-0018.pdf) | Deniability práctica difícil; burn ≠ secure delete | **Documentado** como no-goal en [`SECURITY.es.md`](../SECURITY.es.md) |
| — | [ePrint 2025/1619](https://eprint.iacr.org/2025/1619) | Anonymity Wrappers | **No aplicado** (no-goal) |
| — | [RFC 9420 MLS](https://www.rfc-editor.org/rfc/rfc9420) / KT | Ratchet de grupo + key transparency | **No aplicado** — necesita identidad durable / operador de log |
| `arxiv-2206.12762-snow.pdf` | [SnoW](https://arxiv.org/abs/2206.12762) | Mesh degrada ~4–6 peers | Descargado |
| `arxiv-2510.16168-webrtc-ip.pdf` | [arXiv:2510.16168](https://arxiv.org/abs/2510.16168) | Fuga de IP WebRTC | Descargado |
| `arxiv-2510.27500-dcutr.pdf` | [arXiv:2510.27500](https://arxiv.org/abs/2510.27500) | Tasas de hole-punch NAT | Descargado |
| `arxiv-2311.04658-cgnat.pdf` | [arXiv:2311.04658](https://arxiv.org/abs/2311.04658) | CGNAT / fallos ICE | Descargado |
| `arxiv-2503.17826-crdt.pdf` | [arXiv:2503.17826](https://arxiv.org/abs/2503.17826) | Sync CRDT (futuro) | Descargado |
| `cwtch.pdf` | [Cwtch](https://cwtch.im/cwtch.pdf) | Modelo de infra no confiable | Descargado |

## Volver a descargar

```powershell
# Desde la raíz del repo (User-Agent necesario por 403 de ePrint)
curl.exe -fsSL -A "Mozilla/5.0" -o docs/papers/eprint-2026-584.pdf https://eprint.iacr.org/2026/584.pdf
curl.exe -fsSL -A "Mozilla/5.0" -o docs/papers/popets-2025-0018.pdf https://petsymposium.org/popets/2025/popets-2025-0018.pdf
```
