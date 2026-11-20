# TAZIA documentation

English · [Español](README.es.md)

How to use the app (web, local, and single-file) is in [`README.md`](../README.md).  
This folder holds the technical detail: security, protocol, and networking.

If a crypto or on-the-wire number disagrees with a doc, **trust the code**: [`src/core/protocol.ts`](../src/core/protocol.ts) (bonfire extinguish: [`threadDelete.ts`](../src/core/forum/threadDelete.ts)).

## Guides

| Document | English | Español |
| --- | --- | --- |
| Security (what it protects; burn vs delete vote) | [`SECURITY.md`](SECURITY.md) | [`SECURITY.es.md`](SECURITY.es.md) |
| TAZEP protocol (format, sync, unanimous delete) | [`PROTOCOL.md`](PROTOCOL.md) | [`PROTOCOL.es.md`](PROTOCOL.es.md) |
| TURN / ICE connection (when you can’t find each other) | [`TURN.md`](TURN.md) | [`TURN.es.md`](TURN.es.md) |
| Native TURN (Win/Mac exe + Android APK) | [`tools/tazia-turn/README.md`](../tools/tazia-turn/README.md) | same |
| Coturn Docker (optional) | [`docker/coturn/README.md`](../docker/coturn/README.md) · [`install/`](../docker/coturn/install/README.md) | same |
| SDP/QR spike (experiment, not in the app) | [`sdp-qr-spike.md`](sdp-qr-spike.md) | [`sdp-qr-spike.es.md`](sdp-qr-spike.es.md) |

## Papers

| Document | English | Español |
| --- | --- | --- |
| Index | [`papers/README.md`](papers/README.md) | [`papers/README.es.md`](papers/README.es.md) |
| ePrint abstracts | [`papers/eprint-abstracts.md`](papers/eprint-abstracts.md) | [`papers/eprint-abstracts.es.md`](papers/eprint-abstracts.es.md) |

Naming: `*.md` = English · `*.es.md` = Spanish.
