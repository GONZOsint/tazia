# Protocolo `agora-forum-v1`

Wire format del foro P2P sobre Trystero 0.27 (señalización Nostr + WebRTC).

## Constantes

| Nombre | Valor |
| --- | --- |
| `PROTOCOL_NAME` | `agora-forum-v1` |
| `PROTOCOL_VERSION` | `1` |
| `APP_ID` | `tazia.app` |
| `MAX_USERS` | 48 |
| `MAX_BODY_CHARS` | 8000 |
| `MAX_TITLE_CHARS` | 200 |
| `MAX_ALIAS_CHARS` | 40 |
| `MAX_DM_BODY_CHARS` | 4000 |
| `MAX_SYNC_MESSAGES` | 500 |
| `MAX_SYNC_TOTAL_BYTES` | 2 MB |
| `MAX_PUBLISH_PER_MINUTE` | 30 |
| `MAX_SYNC_ANSWERS_PER_MINUTE` | 12 |
| `LIVE_CLOCK_SKEW_MS` | ±5 min (mensajes en vivo) |
| `SYNC_CLOCK_SKEW_MS` | ±24 h (snapshot histórico) |

Versiones distintas de `1` se **rechazan**.

Límite de UI (no del wire): hasta **5** zonas concurrentes (`MAX_ROOMS` en `useRoomManager`).

## Canales Trystero

| Canal | Tipo | Uso |
| --- | --- | --- |
| `forumMsg` | `makeAction` | Publicación en vivo (hilos / respuestas) |
| `directMsg` | `makeAction` | Susurros (DM) a un `target` |
| `forumSync` | `makeAction(..., { kind: 'request' })` | Snapshot RPC para late joiners |
| `presence` | `makeUserState` | Alias + pubkey de firma (+ X25519 opcional) |

Zona (API Trystero `roomId`):

```ts
joinRoom({ appId, password, identity: 'none', maxUsers }, roomId)
```

Cada zona de la UI es un `joinP2pRoom` aislado.

## Presencia

```ts
{
  alias: string;              // 1–40 chars
  signPubKeySpkiB64: string;  // SPKI Ed25519, base64
  encPubKeyRawB64?: string;   // X25519 raw, base64 — Susurro pairwise v2
}
```

Sin `signPubKeySpkiB64` válida no se aceptan mensajes de ese autor en **sync** (ni en vivo hasta que la clave se conozca).
Si ambos peers publican `encPubKeyRawB64`, los Susurros nuevos van sellados (AES-GCM); peers nuevos rechazan cuerpo en claro cuando ambas claves de cifrado están presentes.

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

UTF-8 → firma Ed25519 (Web Crypto `SubtleCrypto` si hay soporte nativo; si no, `@noble/ed25519`).

### Validación

- Campos tipados y límites de tamaño.
- Reloj: `|now - createdAtMs| ≤ LIVE_CLOCK_SKEW_MS` en vivo; `≤ SYNC_CLOCK_SKEW_MS` en sync. Si no, descartar.
- **En vivo:** `authorUserId === userId` del peer Trystero **y** firma válida frente a la pubkey conocida.
- **Sync:** firma válida frente a pubkey de presencia/cache; si falta clave o falla verify → descartar (incrementa contador de rechazos).
- Rate-limit: > `MAX_PUBLISH_PER_MINUTE` por peer en 60 s → ignorar exceso.
- Snapshot: como máximo `MAX_SYNC_MESSAGES` (más recientes por `createdAtMs`); respuestas > `MAX_SYNC_TOTAL_BYTES` se rechazan.

## Susurros (DM)

```ts
{
  protocolVersion: 1;
  msgId: string;
  fromUserId: string;
  toUserId: string;
  body: string;              // plaintext legacy, or "" when seal===2
  createdAtMs: number;
  bodyCipherB64?: string;    // AES-GCM (iv||ct) base64 when seal===2
  seal?: 2;
  sig: string;
}
```

Canónico firmado:

```
[protocolVersion, msgId, fromUserId, toUserId, body, createdAtMs, bodyCipherB64|'', seal|0]
```

Límite de cuerpo: `MAX_DM_BODY_CHARS` (4000).

### Fallback Nostr de datos

Si ICE falla, el plano de datos puede ir por Nostr cifrado: AES-GCM de sala `tazia.fallback.v2` (PBKDF2 210k + HKDF) con padding de blob versión `0x02`. Topic estable por `roomId`+frase (sin rotación horaria). Relés ven metadatos y ciphertext, no el texto en claro.

## Flujo

```
publish → Ed25519_sign → forumMsg.send
                      ↘ onMessage: author==userId + verify

whisper → Ed25519_sign → directMsg.send({ target })
                      ↘ seal=2 si hay X25519 mutuo

late joiner → forumSync.requestMany({ want: 'snapshot' })
           → verify cada evento con pubkey de presencia
```

## Implementación

- Tipos: [`src/core/protocol.ts`](src/core/protocol.ts)
- Firmas / identidad: [`src/core/crypto/`](src/core/crypto/)
- Mesh: [`src/core/p2p/p2pRoom.ts`](src/core/p2p/p2pRoom.ts)
- Fallback Nostr: [`src/core/p2p/nostrFallback.ts`](src/core/p2p/nostrFallback.ts), [`src/core/p2p/roomCrypto.ts`](src/core/p2p/roomCrypto.ts)
- Multi-zona: [`src/hooks/useRoomManager.ts`](src/hooks/useRoomManager.ts)

## Roadmap de sync

Hoy: merge de eventos firmados + snapshot RPC. Un sync tipado eventual (p. ej. CRDT sobre data channels, cf. [arXiv:2503.17826](https://arxiv.org/html/2503.17826v1)) es futuro — no sustituye la firma Ed25519 de autoría.
