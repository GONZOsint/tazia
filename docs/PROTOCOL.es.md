# Protocolo TAZEP (`tazep-v2`)

Español · [English](PROTOCOL.md)

**TAZEP** (*TAZ Encryption Protocol*) describe el **formato de los mensajes** del foro P2P: qué viaja por Trystero 0.27 (señalización Nostr + WebRTC), cómo se firma y qué se rechaza.

Fuente de verdad: [`src/core/protocol.ts`](../src/core/protocol.ts) y etiquetas en [`src/core/crypto/`](../src/core/crypto/), [`src/core/p2p/`](../src/core/p2p/). Si un número de este documento no coincide con el código, **prioriza el código**.

Peers con `agora-forum-v1` / `agora-forum-v2` **no** se entienden con `tazep-v2` (no hay compatibilidad dual). Etiquetas de dominio: `tazep.*` (no `tazia.*`).

---

## Constantes

| Nombre | Valor |
| --- | --- |
| `PROTOCOL_NAME` | `tazep-v2` |
| `PROTOCOL_VERSION` | `2` |
| `APP_ID` | `tazia.app` (producto / id Trystero — no es el nombre del protocolo) |
| `MAX_USERS` | 50 |
| `MESH_SOFT_WARN_PEERS` | 6 (aviso UX; mesh óptimo) |
| `MAX_SYNC_PEER_TARGETS` | 8 (sample de sync WebRTC) |
| `MAX_BODY_CHARS` | 8000 |
| `MAX_TITLE_CHARS` | 200 |
| `MAX_ALIAS_CHARS` | 40 |
| `MAX_USER_ID_CHARS` | 64 |
| `MAX_SIG_B64_CHARS` | 128 |
| `MAX_DM_BODY_CHARS` | 4000 |
| `MAX_DM_CIPHER_B64_CHARS` | 12_000 |
| `MAX_DM_PER_MINUTE` | 30 |
| `MAX_SYNC_MESSAGES` | 500 |
| `MAX_SYNC_TOTAL_BYTES` | 2 MB |
| `MAX_RECEIVE_BYTES` | ≈ 2.5 MB (`MAX_SYNC_TOTAL_BYTES + 512 KiB`) |
| `MAX_PRESENCE_STATE_BYTES` | 4096 |
| `MAX_PUBLISH_PER_MINUTE` | 30 |
| `MAX_SYNC_ANSWERS_PER_MINUTE` | 12 |
| `LIVE_CLOCK_SKEW_MS` | ±5 min (foro en vivo + Susurros) |
| `SYNC_CLOCK_SKEW_MS` | ±24 h (snapshot histórico) |
| `NOSTR_EVENT_CLOCK_SKEW_SEC` | ±300 s (`created_at` de EVENT Nostr) |

Versiones distintas de `2` se **rechazan**.  
Límite de UI (no del protocolo): hasta **3** zonas concurrentes (`MAX_ROOMS`).

`MAX_USERS=50` es tope blando de Trystero. El mesh completo degrada pasado ~4–6 peers; el sync live muestreá como máximo `MAX_SYNC_PEER_TARGETS`.

---

## Cambios vs agora-forum-v2

| Área | agora-forum-v2 | tazep-v2 |
| --- | --- | --- |
| Nombre / dominio | `agora-forum-v2`, `tazia.*` | `tazep-v2`, `tazep.*` |
| Susurros | solo `seal: 2` | igual |
| Attestation presence | `tazia.presence.v1` | `tazep.presence.v1` |
| Goodbye (Nostr) | sin auth | atestiguado `tazep.goodbye.v1` |
| `sync-res` Nostr | primera respuesta gana | `fromUserId` + Ed25519 `tazep.sync-res.v1` + digest |
| Verify keys | última SPKI observada | **pinned** TOFU hasta `repin` |

---

## Canales Trystero

| Canal | Tipo | Uso |
| --- | --- | --- |
| `forumMsg` | `makeAction` | Publicación en vivo (hilos / respuestas) |
| `directMsg` | `makeAction` | Susurros a un `target` |
| `forumSync` | `makeAction(..., { kind: 'request' })` | Snapshot RPC para late joiners |
| `presence` | `makeUserState` | Alias + pubkey de firma + X25519 |

```ts
joinRoom(
  { appId, password, identity: 'none', maxUsers, maxReceiveBytes, turnConfig?, rtcConfig? },
  roomId
)
```

Cada zona de la UI es un `joinP2pRoom` aislado. Entrar **exige** SubtleCrypto X25519 en el navegador (sin biblioteca de respaldo).

---

## Presencia

```ts
{
  alias: string;              // 1–40 chars
  signPubKeySpkiB64: string;  // SPKI Ed25519, base64
  encPubKeyRawB64: string;    // X25519 raw, base64 — obligatorio
}
```

Sin `signPubKeySpkiB64` válida no se aceptan mensajes de ese autor en **sync** (ni en vivo hasta conocer/pinnear la clave).  
Sin `encPubKeyRawB64` la presencia se rechaza; no hay Susurros en claro.

Presence Nostr lleva `attestSig` sobre:

```
["tazep.presence.v1", roomId, userId, signPubKeySpkiB64, encPubKeyRawB64]
```

Liga claves a un `userId` reclamado (TOFU first-writer). **No** equivale al binding WebRTC de Trystero.

Goodbye Nostr (al salir con fallback activo):

```
["tazep.goodbye.v1", roomId, userId, signPubKeySpkiB64, encPubKeyRawB64]
```

---

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
  sig: string; // Ed25519 sobre el canónico, base64 (IEEE P1363 / raw)
}
```

### Canónico firmado

Orden fijo (JSON array), **sin** `sig`. **Sin `roomId`** — el binding de sala va por mesh / DM sellados / AAD del fallback:

```
[protocolVersion, msgId, type, threadId, parentMsgId, title, body, createdAtMs, authorUserId]
```

**WebRTC en vivo:** aceptar solo si `authorUserId ===` `userId` Trystero del peer; luego verify contra SPKI **pinned**.  
**Sync / fallback Nostr:** sin binding de transporte; rate-limit por `authorUserId`; verify SPKI pinned.

---

## Susurro (DM)

```ts
{
  protocolVersion: 2;
  msgId: string;
  fromUserId: string;
  toUserId: string;
  body: "";                  // vacío en el mensaje de red
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

- AAD AES-GCM: `tazep.dm.aad.v2:{roomId}|{from}|{to}|{msgId}`
- Salt HKDF: `tazep/dm-v2:{roomId}` · info: `tazep/dm-v2`
- Reloj en vivo ±5 min; `body` vacío; `seal` = `2`
- WebRTC: `fromUserId` debe coincidir con el peer de transporte; abrir solo si `toUserId === self`

---

## Fallback Nostr de datos

Si falla ICE (`peer-connect-failed`), TAZIA puede llevar envelopes cifrados por los sockets Nostr abiertos de Trystero.

Material de sala: PBKDF2 210k una vez (salt `tazep.fallback.v2:{roomId}`) + HKDF dual (`tazep/room-key`, `tazep/topic`); blob **`0x03`** + AAD `tazep.fallback.aad.v3:{roomId}`; envelope `v: 2`.

| `t` | Campos (además de `v: 2`) | Auth |
| --- | --- | --- |
| `forum` | `event` | Ed25519 del evento; sin enlace al transporte WebRTC |
| `presence` | `userId`, `state`, `atMs`, `attestSig` | `tazep.presence.v1` |
| `goodbye` | `userId`, claves, `atMs`, `attestSig` | `tazep.goodbye.v1` |
| `dm` | `dm` | Igual que Susurro en el mensaje de red |
| `sync-req` | `fromUserId`, `reqId` | — |
| `sync-res` | `fromUserId`, `toUserId`, `reqId`, `events`, `eventsDigest`, `sig` | ver abajo |

- EVENT: schnorr verify del id canónico + skew de `created_at` **antes** de decrypt.
- `sync-res`: `eventsDigest = hex(SHA-256(JSON.stringify(events)))`; firma sobre  
  `["tazep.sync-res.v1", roomId, reqId, fromUserId, toUserId, eventsDigest]`.
- Los relés ven metadatos y bytes cifrados, no el texto en claro. No es P2P puro.

---

## Flujo

```
publish → Ed25519_sign → forumMsg.send
                      ↘ onMessage: author==userId + verify(pinned)

whisper → X25519 seal + Ed25519_sign → directMsg.send({ target })
                      ↘ seal=2 obligatorio; open con encPub del peer

late joiner → forumSync.requestMany / Nostr sync-req → sync-res (firmado)
           → verify cada evento con pubkey de presencia pinned
```

---

## Mapa de implementación

| Concern | Path |
| --- | --- |
| Tipos / validadores | [`src/core/protocol.ts`](../src/core/protocol.ts) |
| Ed25519 + sync-res | [`src/core/crypto/messageSigning.ts`](../src/core/crypto/messageSigning.ts) |
| Attest presence / goodbye | [`src/core/crypto/presenceAttest.ts`](../src/core/crypto/presenceAttest.ts) |
| Sello DM | [`src/core/crypto/dmCrypto.ts`](../src/core/crypto/dmCrypto.ts) |
| Frase | [`src/core/crypto/passphraseWords.ts`](../src/core/crypto/passphraseWords.ts) |
| Mesh | [`src/core/p2p/p2pRoom.ts`](../src/core/p2p/p2pRoom.ts) |
| Ingest foro / DM | [`forumIngest.ts`](../src/core/p2p/forumIngest.ts), [`dmIngest.ts`](../src/core/p2p/dmIngest.ts) |
| Cache verify pinned | [`verifyKeyRegistry.ts`](../src/core/p2p/verifyKeyRegistry.ts) |
| Fallback Nostr | [`nostrFallback.ts`](../src/core/p2p/nostrFallback.ts), [`roomCrypto.ts`](../src/core/p2p/roomCrypto.ts) |
| Multi-zona | [`src/hooks/useRoomManager.ts`](../src/hooks/useRoomManager.ts) |
| Papers | [`papers/`](papers/) |

---

## Roadmap de sync

Hoy: merge de eventos firmados + snapshot RPC (WebRTC + `sync-res` Nostr firmado). Un sync tipado eventual (p. ej. CRDT) es futuro — no sustituye la firma Ed25519 de autoría. MLS / KT siguen fuera de alcance con `identity: 'none'` y hosting estático.
