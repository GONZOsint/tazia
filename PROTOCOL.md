# Protocolo `agora-forum-v1`

Wire format del foro P2P sobre Trystero 0.27 (Nostr signaling + WebRTC).

## Constantes

| Nombre | Valor |
| --- | --- |
| `PROTOCOL_NAME` | `agora-forum-v1` |
| `protocolVersion` | `1` |
| `APP_ID` | `tazia.app` |
| `MAX_USERS` | 48 |
| `MAX_BODY_CHARS` | 8000 |
| `MAX_TITLE_CHARS` | 200 |
| `MAX_SYNC_MESSAGES` | 500 |
| `MAX_PUBLISH_PER_MINUTE` | 30 |
| `MAX_SYNC_ANSWERS_PER_MINUTE` | 12 |
| `CLOCK_SKEW_MS` | 24 h |

Versiones distintas de `1` se **rechazan**.

## Canales Trystero

| Canal | Tipo | Uso |
| --- | --- | --- |
| `forumMsg` | `makeAction` (mensaje) | Publicación en vivo |
| `forumSync` | `makeAction(..., { kind: 'request' })` | Snapshot RPC para late joiners |
| `presence` | `makeUserState` | Alias + pubkey de firma |

Zona (API Trystero `roomId`): `joinRoom({ appId, password, identity: 'none', maxUsers }, roomId)`.
La UI permite hasta 5 zonas concurrentes (`useRoomManager`); cada una es un `joinP2pRoom` aislado.

## Presencia

```ts
{
  alias: string;              // 1–40 chars
  signPubKeySpkiB64: string;  // SPKI Ed25519, base64
}
```

Sin `signPubKeySpkiB64` válida no se aceptan mensajes de ese autor en **sync** (ni en vivo hasta que la clave se conozca).

## Evento de foro

```ts
{
  protocolVersion: 1;
  msgId: string;
  type: 'NEW_THREAD' | 'REPLY';
  threadId: string;
  parentMsgId: string | null;
  title: string;
  body: string;
  createdAtMs: number;
  authorUserId: string;
  sig: string; // Ed25519 sobre el canónico, base64
}
```

### Canónico firmado

Orden fijo (JSON array), **sin** `sig`:

```
[protocolVersion, msgId, type, threadId, parentMsgId, title, body, createdAtMs, authorUserId]
```

UTF-8 → `crypto.subtle.sign({ name: 'Ed25519' }, …)`.

### Validación

- Campos tipados y límites de tamaño.
- `|now - createdAtMs| ≤ CLOCK_SKEW_MS` (si no, descartar).
- **En vivo:** `authorUserId === userId` del peer Trystero **y** firma válida frente a la pubkey conocida.
- **Sync:** firma válida frente a pubkey de presencia/cache; si falta clave o falla verify → descartar (incrementa contador de rechazos).
- Rate-limit: > `MAX_PUBLISH_PER_MINUTE` por peer en 60 s → ignorar exceso.
- Snapshot: como máximo `MAX_SYNC_MESSAGES` (más recientes por `createdAtMs`).

## Flujo

```
publish → Ed25519_sign → forumMsg.send
                      ↘ onMessage: author==userId + verify

late joiner → forumSync.requestMany({ want: 'snapshot' })
           → verify cada evento con pubkey de presencia
```

## Implementación

- Tipos: [`src/core/protocol.ts`](src/core/protocol.ts)
- Firmas / identidad: [`src/core/crypto/`](src/core/crypto/)
- Mesh: [`src/core/p2p/p2pRoom.ts`](src/core/p2p/p2pRoom.ts)
- Multi-zona: [`src/hooks/useRoomManager.ts`](src/hooks/useRoomManager.ts)

## Roadmap de sync

Hoy: merge de eventos firmados + snapshot RPC. Un sync tipado eventual (p. ej. CRDT sobre data channels, cf. [arXiv:2503.17826](https://arxiv.org/html/2503.17826v1)) es futuro — no sustituye la firma Ed25519 de autoría.
