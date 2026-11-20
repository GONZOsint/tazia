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
| `MAX_FALLBACK_CIPHER_B64_CHARS` | 96_000 (`content` de EVENT Nostr antes de verify/decrypt) |
| `MAX_DM_PER_MINUTE` | 30 |
| `MAX_SYNC_MESSAGES` | 500 |
| `MAX_SYNC_TOTAL_BYTES` | 2 MB |
| `MAX_RECEIVE_BYTES` | ≈ 2.5 MB (`MAX_SYNC_TOTAL_BYTES + 512 KiB`) |
| `MAX_PRESENCE_STATE_BYTES` | 4096 |
| `MAX_FORUM_WIRE_BYTES` | `4096 + MAX_TITLE_CHARS×6 + MAX_BODY_CHARS×6 + MAX_SIG_B64_CHARS` (= 53 424) |
| `MAX_PUBLISH_PER_MINUTE` | 30 |
| `MAX_SYNC_ANSWERS_PER_MINUTE` | 12 |
| `MAX_PRESENCE_PER_MINUTE` | 20 (presence/goodbye Nostr por pubkey del EVENT) |
| Tope global fallback | `×3` los límites por peer (anti-amplificación blanda) |
| `LIVE_CLOCK_SKEW_MS` | ±5 min (foro en vivo + Susurros) |
| `SYNC_CLOCK_SKEW_MS` | ±24 h (snapshot histórico) |
| `NOSTR_EVENT_CLOCK_SKEW_SEC` | ±300 s (`created_at` de EVENT Nostr) |

Versiones distintas de `2` se **rechazan**.  
Límite de UI (no del protocolo): hasta **3** zonas concurrentes (`MAX_ROOMS`).

`MAX_USERS=50` es tope blando de Trystero. El mesh completo degrada pasado ~4–6 peers; el sync live muestrea como máximo `MAX_SYNC_PEER_TARGETS`.

Los rate limits son hedges **solo en el cliente** (en memoria). En fallback Nostr se clavean por pubkey del EVENT; rotar pubkeys puede multiplicar el throughput hasta los buckets globales `×3`.

---

## Cambios vs agora-forum-v2

| Área | agora-forum-v2 | tazep-v2 |
| --- | --- | --- |
| Nombre / dominio | `agora-forum-v2`, `tazia.*` | `tazep-v2`, `tazep.*` |
| Susurros | solo `seal: 2` | igual |
| Attestation presence | `tazia.presence.v1` | `tazep.presence.v4` + `atMs` + `alias` + `avatarSeed` |
| Goodbye (Nostr) | sin auth | atestiguado `tazep.goodbye.v3` + `atMs` |
| Sync WebRTC | `ForumEvent[]` crudo | digest firmado (`tazep.sync-res.v1`) |
| `sync-res` Nostr | primera respuesta gana | `fromUserId` + Ed25519 `tazep.sync-res.v1` + digest; **merge** de respuestas válidas hasta timeout |
| Verify keys | última SPKI observada | **pinned** TOFU hasta `repin` |
| Apagar hoguera | ninguno (solo append) | `DELETE_PROPOSE` / `DELETE_VOTE` unánime + tumbas |

---

## Canales Trystero

| Canal | Tipo | Uso |
| --- | --- | --- |
| `forumMsg` | `makeAction` | Publicación en vivo (hogueras / respuestas / voto de apagado) |
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
  alias: string;              // 1–40 chars, canónico
  signPubKeySpkiB64: string;  // SPKI Ed25519, base64
  encPubKeyRawB64: string;    // X25519 raw, base64 — obligatorio
  avatarSeed: string;         // seed compacto de llamita — obligatorio
}
```

`alias` debe ser **canónico**: trim, sin controles bidi Unicode (`U+200E`, `U+200F`, `U+202A`–`U+202E`, `U+2066`–`U+2069`). Quien publica usa `normalizePresenceAlias` ([`src/core/presenceAlias.ts`](../src/core/presenceAlias.ts)); los peers **rechazan** alias no canónicos con `isValidPresenceState` (sin reescritura silenciosa).

Sin `signPubKeySpkiB64` válida no se aceptan mensajes de ese autor en **sync** (ni en vivo hasta conocer/pinnear la clave).  
Sin `encPubKeyRawB64` la presencia se rechaza; no hay Susurros en claro.  
`avatarSeed` debe ser `v1.<p>.<f>.<e>.<m>.<d>.<hex8>` ([`avatarSeed.ts`](../src/core/avatar/avatarSeed.ts)); sin seed válido se rechaza el estado.

**WebRTC vs Nostr:** la presence WebRTC en vivo solo valida forma y el `userId` de transporte Trystero (sin attestation Ed25519 de presence). Presence Nostr lleva `attestSig` sobre:

```
["tazep.presence.v4", roomId, userId, signPubKeySpkiB64, encPubKeyRawB64, atMs, alias, avatarSeed]
```

`atMs` debe estar dentro de `LIVE_CLOCK_SKEW_MS` y ser **estrictamente creciente** por `userId` en el receptor. Liga claves + alias + avatar a un `userId` reclamado (TOFU first-writer). **No** equivale al binding WebRTC de Trystero. SPKI de firma y X25519 enc se **pinnean juntos**; un sign `changed` **no** actualiza la enc de Susurros, y la enc no rota en silencio bajo el mismo SPKI. La presence WebRTC tiene prioridad sobre Nostr para el mismo `userId`.

Goodbye Nostr (al salir con fallback activo):

```
["tazep.goodbye.v3", roomId, userId, signPubKeySpkiB64, encPubKeyRawB64, atMs]
```

El goodbye solo elimina al peer si `signPubKeySpkiB64` coincide con la clave fijada.

---

## Evento de foro

```ts
{
  protocolVersion: 2;
  msgId: string;
  type: 'NEW_THREAD' | 'REPLY' | 'DELETE_PROPOSE' | 'DELETE_VOTE';
  threadId: string;
  parentMsgId: string | null;
  title: string;
  body: string;
  createdAtMs: number;
  authorUserId: string;
  sig: string; // Ed25519 sobre el canónico, base64 (IEEE P1363 / raw)
}
```

### Contenido vs voto de apagado

| Tipo | Rol |
| --- | --- |
| `NEW_THREAD` | Raíz de una hoguera (`parentMsgId` = `null`; `body` no vacío) |
| `REPLY` | Respuesta (`parentMsgId` = `msgId` padre; `body` no vacío) |
| `DELETE_PROPOSE` / `DELETE_VOTE` | Ballot sobre un `threadId` — no se muestran como posts |

### Apagar hoguera (voto unánime de la tribu)

| Tipo | `parentMsgId` | `title` | `body` |
| --- | --- | --- | --- |
| `DELETE_PROPOSE` | `null` | `""` | `userId`s online únicos ordenados (`localeCompare` `en`, separados por coma); debe incluir al autor |
| `DELETE_VOTE` | `msgId` de la propuesta | `""` | `"aye"` |

Reglas (fuente: [`threadDelete.ts`](../src/core/forum/threadDelete.ts); aplicadas en [`forumIngest.ts`](../src/core/p2p/forumIngest.ts) para remoto **y** publish local):

1. **Una propuesta por `threadId`** — se rechazan `DELETE_PROPOSE` posteriores. Solo el ballot **más antiguo** puede autorizar la purga.
2. **Cobertura del electorado (vivo / fallback Nostr)** — el body debe incluir a todo peer que este receptor ya consideraba online en `createdAtMs` (±2 s de sesgo por join: quien apareció después puede omitirse). El **sync** histórico no aplica cobertura (tumbas ya acordadas en otro sitio).
3. **Votos** — el padre debe existir como ese `DELETE_PROPOSE` primario, con el mismo `threadId`; autor ∈ electorado. Los votos huérfanos esperan un momento al padre y luego se descartan.
4. **Cierre** — quien propone cuenta como aye. Cuando todos los electores votan aye, los peers purgan `NEW_THREAD` / `REPLY` de ese `threadId`, conservan `DELETE_*` como tumbas y omiten el contenido en snapshots de sync ([`syncCoordinator.ts`](../src/core/p2p/syncCoordinator.ts)).

```
proponer(onlineIds) → DELETE_PROPOSE
                   ↘ peers: cobertura + guardar
voto → DELETE_VOTE (padre = propose)
    ↘ cuando |votos| == |electorado|: purgar contenido, conservar tumbas
```

UI: Foro → apagar hoguera → confirmar → banner de progreso hasta unanimidad. Solo en la zona ⇒ la propuesta se completa al instante.

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

Material de sala: PBKDF2 210k una vez (salt `tazep.fallback.v2:{roomId}`) + HKDF dual (`tazep/room-key`, `tazep/topic`); blob **`0x03`** + AAD `tazep.fallback.aad.v3:{roomId}`; la mayoría de envelopes `v: 2`.

| `t` | Campos | Auth |
| --- | --- | --- |
| `forum` (`v: 2`) | `event` | Ed25519 del evento; sin enlace al transporte WebRTC |
| `presence` (`v: 2`) | `userId`, `state`, `atMs`, `attestSig` | `tazep.presence.v4` |
| `goodbye` (`v: 2`) | `userId`, claves, `atMs`, `attestSig` | `tazep.goodbye.v3` |
| `dm` (`v: 2`, legacy) | `dm` | Igual que Susurro; los co-miembros ven metadatos tras decrypt de sala |
| `dm-wrap` (`v: 3`) | solo `blobB64` | **Solo fallback Nostr** (en WebRTC los Susurros siguen en `seal: 2`). AES pairwise (HKDF `tazep/dm-wrap:{userIdsOrdenados}`) + AAD `tazep.dm-wrap.aad.v1:{roomId}`; el publish sube `dm` → `dm-wrap`; se acepta `dm` legacy |
| `sync-req` (`v: 2`) | `fromUserId`, `reqId` | — |
| `sync-res` (`v: 2`) | `fromUserId`, `toUserId`, `reqId`, `events`, `eventsDigest`, `sig` | ver abajo |

- EVENT: schnorr verify del id canónico + skew de `created_at` **antes** de decrypt.
- `sync-res`: `eventsDigest = hex(SHA-256(JSON.stringify(events)))`; firma sobre  
  `["tazep.sync-res.v1", roomId, reqId, fromUserId, toUserId, eventsDigest]`.
  Las respuestas válidas se **fusionan** hasta el timeout de la petición (no gana la primera).
- Los relés ven metadatos y bytes cifrados, no el texto en claro. No es P2P puro.
- Quien conoce la frase sigue descifrando la capa de **sala**; `dm-wrap` (solo ruta de fallback) oculta metadatos de Susurro a co-miembros (timing/tamaño aún filtran).

---

## Flujo

```
publish → Ed25519_sign → forumIngest (mismas reglas que remoto) → forumMsg.send
                      ↘ onMessage: author==userId + verify(pinned) + guards de borrado

borrar  → DELETE_PROPOSE / DELETE_VOTE (mismo canal forumMsg)
                      ↘ unánime → purgar contenido; sync solo tumbas

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
| Apagado unánime de hoguera | [`src/core/forum/threadDelete.ts`](../src/core/forum/threadDelete.ts) |
| Ed25519 + sync-res | [`src/core/crypto/messageSigning.ts`](../src/core/crypto/messageSigning.ts) |
| Attest presence / goodbye | [`src/core/crypto/presenceAttest.ts`](../src/core/crypto/presenceAttest.ts) |
| Sello DM | [`src/core/crypto/dmCrypto.ts`](../src/core/crypto/dmCrypto.ts) |
| Frase | [`src/core/crypto/passphraseWords.ts`](../src/core/crypto/passphraseWords.ts) |
| Mesh | [`src/core/p2p/p2pRoom.ts`](../src/core/p2p/p2pRoom.ts) |
| Ingest foro / DM | [`src/core/p2p/forumIngest.ts`](../src/core/p2p/forumIngest.ts), [`src/core/p2p/dmIngest.ts`](../src/core/p2p/dmIngest.ts) |
| Snapshot sync (tumbas) | [`syncCoordinator.ts`](../src/core/p2p/syncCoordinator.ts) |
| Cache verify pinned | [`verifyKeyRegistry.ts`](../src/core/p2p/verifyKeyRegistry.ts) |
| Fallback Nostr | [`nostrFallback.ts`](../src/core/p2p/nostrFallback.ts), [`roomCrypto.ts`](../src/core/p2p/roomCrypto.ts) |
| Multi-zona | [`src/hooks/useRoomManager.ts`](../src/hooks/useRoomManager.ts) |
| Papers | [`papers/`](papers/) |

---

## Roadmap de sync

Hoy: merge de eventos firmados + snapshot RPC (WebRTC + `sync-res` Nostr firmado). Un sync tipado eventual (p. ej. CRDT) es futuro — no sustituye la firma Ed25519 de autoría. MLS / KT siguen fuera de alcance con `identity: 'none'` y hosting estático.
