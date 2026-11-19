# Documentación de TAZIA

Español · [English](README.md)

Cómo usar la app (web, local y single-file) está en [`README.es.md`](../README.es.md).  
Aquí está el detalle técnico: seguridad, protocolo y red.

Si un número de cifrado o de mensajes en red no coincide con un texto, **prioriza el código**: [`src/core/protocol.ts`](../src/core/protocol.ts) (borrado de charlas: [`threadDelete.ts`](../src/core/forum/threadDelete.ts)).

## Guías

| Documento | English | Español |
| --- | --- | --- |
| Seguridad (qué protege y qué no; burn vs voto de borrado) | [`SECURITY.md`](SECURITY.md) | [`SECURITY.es.md`](SECURITY.es.md) |
| Protocolo TAZEP (formato, sync, borrado unánime) | [`PROTOCOL.md`](PROTOCOL.md) | [`PROTOCOL.es.md`](PROTOCOL.es.md) |
| Conexión TURN / ICE (cuando no os encontráis) | [`TURN.md`](TURN.md) | [`TURN.es.md`](TURN.es.md) |
| Spike SDP/QR (experimento, no en la app) | [`sdp-qr-spike.md`](sdp-qr-spike.md) | [`sdp-qr-spike.es.md`](sdp-qr-spike.es.md) |

## Papers

| Documento | English | Español |
| --- | --- | --- |
| Índice | [`papers/README.md`](papers/README.md) | [`papers/README.es.md`](papers/README.es.md) |
| Abstracts ePrint | [`papers/eprint-abstracts.md`](papers/eprint-abstracts.md) | [`papers/eprint-abstracts.es.md`](papers/eprint-abstracts.es.md) |

Convención: `*.md` = inglés · `*.es.md` = español.
