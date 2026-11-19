# Protocolo `agora-forum-v2`

Wire format del foro P2P sobre Trystero 0.27 (señalización Nostr + WebRTC).

**Breaking:** peers v1 (`agora-forum-v1`) no interoperan. No hay dual-stack.

## Constantes

| Nombre | Valor |
| --- | --- |
| `PROTOCOL_NAME` | `agora-forum-v2` |
| `PROTOCOL_VERSION` | `2` |
| `APP_ID` | `tazia.app` |
| `MAX_USERS` | 50 |
| `MESH_SOFT_WARN_PEERS` | 6 (aviso UX; mesh óptimo) |
| `MAX_SYNC_PEER_TARGETS` | 8 (sample de sync WebRTC) |
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

Versiones distintas de `2` se **rechazan**.

Límite de UI (no del wire): hasta **3** zonas concurrentes (`MAX_ROOMS` en `useRoomManager`).

**Nota de escala:** `MAX_USERS=50` es tope blando de Trystero. El mesh WebRTC completo degrada pasado ~4–6 peers; sync live muestreá como máximo `MAX_SYNC_PEER_TARGETS` peers.

## Cambios v1 → v2

| Área | v1 | v2 |
| --- | --- | --- |
| Susurros | plaintext opcional | **solo** `seal: 2` + `bodyCipherB64`; `body` vacío en el wire |
| Presence | `encPubKeyRawB64` opcional | **obligatorio** (X25519) |
| DM crypto | HKDF sin room | salt/`AAD` ligados a `roomId‖from‖to‖msgId` |
| Fallback blob | `0x02` sin AAD / `0x03` dual | solo `0x03` + AAD `roomId` |
| Envelope Nostr | `v: 1` | `v: 2` |

## Canales Trystero

| Canal | Tipo | Uso |
| --- | --- | --- |
| `forumMsg` | `makeAction` | Publicación en vivo (hilos / respuestas) |
| `directMsg` | `makeAction` | Susurros (DM) a un `target` |
| `forumSync` | `makeAction(..., { kind: 'request' })` | Snapshot RPC para late joiners |
| `presence` | `makeUserState` | Alias + pubkey de firma + X25519 |

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
  encPubKeyRawB64: string;    // X25519 raw, base64 — required
}
```

Sin `signPubKeySpkiB64` válida no se aceptan mensajes de ese autor en **sync** (ni en vivo hasta que la clave se conozca).
Sin `encPubKeyRawB64` la presencia se rechaza; no hay Susurros en claro.

## Evento de foro

```ts
{
  protocolVersion: 2;
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

## Susurro (DM)

```ts
{
  protocolVersion: 2;
  msgId: string;
  fromUserId: string;
  toUserId: string;
  body: "";                  // vacío en el wire
  createdAtMs: number;
  bodyCipherB64: string;     // AES-GCM (iv||ct) base64
  seal: 2;
  sig: string;
}
```

Canónico firmado:

```
[protocolVersion, msgId, fromUserId, toUserId, body, createdAtMs, bodyCipherB64, seal]
```

AES-GCM AAD: `tazia.dm.aad.v2:{roomId}|{from}|{to}|{msgId}`. HKDF salt: `tazia.app/dm-v2:{roomId}`.

### Fallback Nostr de datos

Si ICE falla, el plano de datos puede ir por Nostr cifrado: AES-GCM de sala (PBKDF2 210k **una vez** + HKDF dual) con padding; blob `0x03` + AAD `roomId`. Envelope `v: 2`. Topic estable por `roomId`+frase. Relés ven metadatos y ciphertext, no el texto en claro.

## Flujo

```
publish → Ed25519_sign → forumMsg.send
                      ↘ onMessage: author==userId + verify

whisper → X25519 seal + Ed25519_sign → directMsg.send({ target })
                      ↘ seal=2 obligatorio

late joiner → forumSync.requestMany({ want: 'snapshot' }, sample ≤ MAX_SYNC_PEER_TARGETS)
           → verify cada evento con pubkey de presencia
```

## Implementación

- Tipos: [`src/core/protocol.ts`](src/core/protocol.ts)
- Firmas / identidad / bytes: [`src/core/crypto/`](src/core/crypto/)
- Mesh: [`src/core/p2p/p2pRoom.ts`](src/core/p2p/p2pRoom.ts) + ingest/sync modules
- Fallback Nostr: [`src/core/p2p/nostrFallback.ts`](src/core/p2p/nostrFallback.ts), [`src/core/p2p/roomCrypto.ts`](src/core/p2p/roomCrypto.ts)
- Multi-zona: [`src/hooks/useRoomManager.ts`](src/hooks/useRoomManager.ts)
- Papers locales: [`docs/papers/`](docs/papers/)

## Roadmap de sync

Hoy: merge de eventos firmados + snapshot RPC. Un sync tipado eventual (p. ej. CRDT sobre data channels, cf. [arXiv:2503.17826](https://arxiv.org/html/2503.17826v1)) es futuro — no sustituye la firma Ed25519 de autoría. OpenMLS / WASM sigue en roadmap (sin delivery service en este ciclo).
