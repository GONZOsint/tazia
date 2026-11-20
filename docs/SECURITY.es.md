# Seguridad — TAZIA

Español · [English](SECURITY.md)

Cómo piensa TAZIA la seguridad: quién puede ver qué, qué mitiga hoy y qué **no** promete.

Formato de mensajes: [`PROTOCOL.es.md`](PROTOCOL.es.md). Conexión / TURN: [`TURN.es.md`](TURN.es.md). Papers: [`papers/`](papers/).  
Protocolo: **TAZEP** `tazep-v2` · app: `tazia.app`.

---

## Qué es (y qué no)

TAZIA es una **asamblea en vivo**. El grupo comparte una frase, monta una red peer-to-peer con WebRTC (vía Trystero) y habla mientras haya pestañas abiertas.

No es un messenger asíncrono (tipo “deja el mensaje y lo leo mañana”), no es Tor y no hay un servidor de confianza que guarde el chat. Si nadie más está online, la sala se apaga.

---

## Quién puede ver qué

| Actor | Qué puede hacer |
| --- | --- |
| Quien conoce la frase | Entra a la zona, publica, pide o sirve sync |
| Peer malicioso *dentro* de la zona | Puede mentir en su UI local; no debe forjar historial ajeno firmado |
| Operador de relé Nostr | Ve la señalización cifrada; si el chat va por el plan B (fallback), también ve el texto ya cifrado (AES-GCM), no el mensaje en claro |
| Observador de red / STUN | Puede ver IPs de quienes usan WebRTC |
| Operador TURN (si lo configuráis) | Ve IP y tráfico WebRTC cifrado; no puede inventar firmas de la app |
| Hosting estático | Sirve JS/CSS; no almacena mensajes |

**No hay API HTTP de aplicación.** La superficie en runtime es assets estáticos, WebRTC, `wss:` de Trystero/Nostr y TURN opcional del usuario — no hay backend de TAZIA que guarde mensajes ni credenciales.

### Visibilidad de IP (honesto)

| Camino | ¿Los peers ven tu IP? | Tercero |
| --- | --- | --- |
| WebRTC + STUN por defecto | Sí (`host` / `srflx`) | Operadores STUN por defecto (Google/Cloudflare vía Trystero) |
| Apoyo on + ocultar dirección off | A menudo sí hasta que el tráfico relea | STUN; TURN cuando hay relay |
| **Ocultar mi dirección de internet** + apoyo que funciona (default al activar el apoyo) | No (solo la IP del apoyo) | El operador del apoyo ve tu IP |
| Fallback Nostr (datos) | Sin ICE directo entre peers | El relé Nostr ve tu IP + cifrado |

Al activar un servidor de apoyo, **Ocultar mi dirección de internet** (solo-relay) queda **encendido por defecto** (desmárcalo para candidatos host en la misma LAN). Ajustes del navegador (p. ej. Brave *WebRTC IP Handling*) pueden ocultar candidatos host; no es Tor y puede romper el mesh en la misma LAN. Identificadores mDNS / CGNAT aún pueden filtrar en algunos navegadores aunque se ofusque la IP LAN ([arXiv:2510.16168](https://arxiv.org/abs/2510.16168)).

---

## Cómo se protege hoy

### Acceso a la zona

La **frase** es la llave: Trystero deriva de ella el cifrado del handshake de descubrimiento. Sin frase no hay red útil entre peers. Por defecto son **6 palabras en español** (~48 bits; lista de 256 términos en `passphraseWords.ts`). Crear o entrar exige una frase suficientemente fuerte (puntuación ≥ good). Hasta **3 zonas** a la vez; tope blando de **50** peers por zona (`MAX_USERS`).

### Identidad

Cada pestaña/zona es un `userId` nuevo (`identity: 'none'`). **Apagar la llama** cierra todos los meshes locales de este dispositivo.

### Apagar una hoguera (voto de la tribu)

No hay “borrar mensaje” unilateral. En el Foro, proponer apagar una hoguera (hilo) congela el electorado (tribu online en ese momento) y exige **aye unánime** (`DELETE_PROPOSE` / `DELETE_VOTE` en [`PROTOCOL.es.md`](PROTOCOL.es.md)).

- Quien propone cuenta como aye; si estás solo, se apaga al instante.
- En **vivo / fallback Nostr**, los peers rechazan propuestas que **encojan** el electorado respecto a quien ya veían online (anti “apagar sin el resto”).
- El **sync** histórico omite esa comprobación de cobertura para que late joiners apliquen tumbas firmadas ya acordadas; no revalidan quién estaba online al proponer.
- Una sola propuesta por hoguera; al completar, se purgan `NEW_THREAD` / `REPLY` y quedan tumbas firmadas (el sync no debe resucitar el contenido).
- **No** es lo mismo que apagar la llama: el voto apaga esa hoguera en los peers que aplican el quórum; apagar la llama olvida **todas** las zonas en **este** dispositivo.

Detalle de reglas: [`threadDelete.ts`](../src/core/forum/threadDelete.ts).

### Mensajes en vivo (WebRTC)

Un `forumMsg` solo se acepta si `authorUserId` coincide con el `userId` Trystero del peer. DTLS **no** cuenta como autoría ([ePrint 2026/584](https://eprint.iacr.org/2026/584)).

Los **Susurros** van sellados (`seal: 2`) con AAD `tazep.dm.aad.v2:…`. Entrar a una zona **exige** SubtleCrypto X25519 en el navegador; si el navegador no lo tiene, el join falla (no hay biblioteca de respaldo). En la red no viaja el texto en claro.

### Cuando WebRTC no llega (fallback Nostr)

Si falla ICE (el navegador no logra la ruta P2P), el chat puede seguir por relés Nostr **cifrados** (PBKDF2 210k + HKDF `tazep/*`; blob `0x03` + AAD `tazep.fallback.aad.v3:{roomId}`; envelope `v: 2`).

Ahí la autenticación es de la aplicación, no del cable WebRTC: los mensajes de foro se aceptan con Ed25519 y la clave **fijada** en el registro (sin inventar un `liveUserId`). La presence exige una attestation firmada `["tazep.presence.v4", …, atMs, alias, avatarSeed]` (reloj ±5 min, `atMs` estricto) antes de fijar TOFU. El goodbye también va atestiguado; las respuestas `sync-res` van firmadas (también el sync WebRTC) y se fusionan hasta el timeout; se comprueba el reloj del EVENT; `schnorr.verify` corre **antes** de descifrar. Los rate limits del fallback (foro, DM, sync, presence/goodbye) usan la pubkey Nostr del EVENT, no solo el `userId` reclamado.

La attestation liga claves a un `userId` reclamado (el primero que escribe gana el pin TOFU de firma+enc). Un pin Nostr prematuro de otro `userId` puede hacer fallar el tráfico firmado legítimo hasta un `repin` explícito (DoS de identidad / UX) — compara el SAS antes de confiar en peers solo-Nostr. Un cambio de firma (`changed`) **no** redirige la clave X25519 de Susurros. Presence WebRTC tiene prioridad sobre Nostr. **No** equivale al enlace WebRTC de Trystero. Los relés ven metadatos y bytes cifrados — no es P2P puro.

### Sincronización y firmas

Cada evento lleva firma **Ed25519** sobre el payload canónico. La verificación usa la clave SPKI **fijada** hasta un `repin` explícito. Instantáneas sin firma o sin clave conocida se **descartan**.

Reloj: foro y Susurros en vivo ±5 min; sync histórico ±24 h; EVENT Nostr ±300 s.  
Límites blandos (solo cliente, en memoria): 30 publicaciones/min/peer, 30 Susurros/min, 12 respuestas de sync/min, 20 presence/goodbye/min en fallback Nostr; los buckets globales del fallback son `×3` esos topes. El sync WebRTC se muestrea a 8 peers. Sync > 2 MB se rechaza (`maxReceiveBytes` ≈ 2.5 MB). Rotar pubkeys de EVENT Nostr puede multiplicar el throughput hasta los globales — son hedges de abuso, no una frontera dura.

### Confianza entre personas

**WebRTC:** la primera clave de firma (+ enc) vista para un `userId` Trystero se fija (TOFU). La presence en el cable solo valida forma — **no** lleva attestation Ed25519; el binding de autoría está en foro/DM (`authorUserId` / `fromUserId` debe coincidir con el peer de transporte).  
**Nostr:** solo tras presence atestiguada (`tazep.presence.v4`).  
Código de seguridad (SAS): **6** emojis de un pool de **256** (~48 bits) + binding a `roomId`, derivados de las claves SPKI **y** X25519 fijadas ([ePrint 2025/1598](https://eprint.iacr.org/2025/1598)). Si rota la clave → estado `changed`; la verificación sigue en la clave fijada hasta un `repin` explícito (sin “auto-reparar” en silencio). Una clave de firma `changed` **no** redirige las claves **enc** de Susurro.

### Red, consentimiento y burn

Consentimiento de IP la primera vez (peers **y** terceros: STUN por defecto, relés Nostr, TURN si lo configuras). Quemar **no** lo borra por defecto; Ayuda → «Olvidar este dispositivo» limpia consentimiento IP + TURN + relés Nostr (sesión y persistidos); al apagar la llama puedes marcar el mismo wipe.  
La frase en la URL se limpia (`public/scrub-phrase.js` + React).  
TURN es opcional: `sessionStorage` (`tazia:turn-config`) por defecto; TURN recordado solo en `tazia:turn-config-persist`. Relés Nostr propios: `tazia:nostr-relays` / `tazia:nostr-relays-persist` (solo `wss:`; si están vacíos se usan los defaults de Trystero). Consentimiento IP solo en `tazia-ip-consent`. Los shims de migración legacy (`agora-ip-consent`, clave TURN sin `-persist` en `localStorage`) están eliminados. Burn limpia sessionStorage; prefs recordadas / consentimiento IP permanecen salvo el checkbox de olvidar prefs al apagar. Detalle: [`TURN.es.md`](TURN.es.md).  
CSP / fuentes: meta CSP en `index.html` (activa en GitHub Pages). [`../public/_headers`](../public/_headers) es plantilla para hosts que sí aplican cabeceras (Netlify/CF); Pages **no** aplica `_headers`, así que `frame-ancestors` / `X-Frame-Options` no están en el despliegue github.io por defecto (la meta CSP no puede fijar `frame-ancestors` — el clickjacking se mitiga con cabeceras HTTP reales en hosts de producción).

**Apagar la llama** cierra las redes locales, limpia la confianza guardada, borra referencias sensibles, hace `sessionStorage.clear` y recarga. **No** es borrado forense ni denegabilidad práctica ([PoPETs 2025](https://petsymposium.org/popets/2025/popets-2025-0018.pdf)).

---

## Límites honestos

- **Anonimato fuerte** — WebRTC filtra IP (a veces LAN vía mDNS). No fingimos anonimato ([arXiv:2510.16168](https://arxiv.org/abs/2510.16168), [RFC 8828](https://www.rfc-editor.org/rfc/rfc8828.html)).
- **CGNAT sin TURN** — STUN suele fallar detrás de CGNAT ([arXiv:2311.04658](https://arxiv.org/html/2311.04658v2), [arXiv:2510.27500](https://arxiv.org/html/2510.27500)). GitHub Pages no sirve TURN.
- **Anonymity Wrappers** — [ePrint 2025/1619](https://eprint.iacr.org/2025/1619) no implementado.
- **DTLS como prueba de autoría** — no ([ePrint 2026/584](https://eprint.iacr.org/2026/584.pdf)). DTLS ≠ E2E de Susurros.
- **Deniability práctica** — no la reclamamos. Las firmas Ed25519 son atribuibles; burn limpia esta pestaña, no otros dispositivos ni relés.
- **Burn ≠ secure delete** — no se pueden zeroizar `CryptoKey` no extractables; la recarga reduce superficie en RAM.
- **Voto de apagado ≠ garantía global** — un peer que nunca recibió el ballot completo puede seguir mostrando la hoguera; no hay servidor que imponga el apagado a todos.
- **Cover de electorado omitido en sync** — late joiners aplican tumbas `DELETE_*` firmadas sin re-comprobar el electorado frente a su set online local (diseño para historia ya acordada).
- **Carrera TOFU Nostr** — la primera presence atestiguada de un `userId` gana el pin; un pin erróneo exige SAS + `repin`.
- **Clave Nostr compartida de zona** — quien conoce la frase deriva el mismo AES de sala y descifra foro/presence/sync. Solo en **fallback Nostr**, Susurro usa **`dm-wrap` v3** (AES pairwise interior) para que los co-miembros no vean metadatos de DM tras el decrypt de sala; puede seguir llegando `dm` v2 legacy. En WebRTC los Susurros siguen en **`seal: 2`** (no dm-wrap). Timing/tamaño aún filtran. No es un MPCS ([SoK](https://petsymposium.org/popets/2024/popets-2024-0030.pdf)).
- **Firmas de foro sin `roomId`** — el payload canónico del foro no lleva id de zona; el replay entre zonas de un evento firmado es un límite honesto (sync-res y AAD de DM sí atan `roomId`).
- **Rate limits solo en cliente** — hedges blandos; no los imponen relés ni un referee.
- **MLS / Double Ratchet / Key Transparency** — necesitan identidad durable u operador de log; incompatibles con `identity: 'none'` + hosting estático puro ([RFC 9420](https://www.rfc-editor.org/rfc/rfc9420)).
- **Tor / señalización onion / Anonymity Wrappers / MPCS con TEE** — fuera de alcance con hosting estático (ver [`papers/README.es.md`](papers/README.es.md)).
- **Wake Lock** — opcional; mantiene la pantalla, no evita que iOS mate WebRTC al backgroundear.

---

## Despliegue

- Hosting estático: `npm run build` → `dist/`.
- Un solo HTML: `npm run build:single` → `release/tazia-single.html` + `.sha256` (build verificable; cómo abrirlo: [`README.es.md`](../README.es.md)). No sustituye el despliegue multi-archivo de Pages. El workflow de Pages también sube ese artefacto (CSP del single incluye `unsafe-inline`; el deploy `dist/` no).
- Spike SDP/QR: [`sdp-qr-spike.es.md`](sdp-qr-spike.es.md) — no va en la app; no sustituye Trystero.

Cabeceras sugeridas:

```
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' wss:; worker-src 'self' blob:;
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(self), microphone=(), geolocation=(), local-network=(self), loopback-network=(self)
```

Los relés Nostr usan `wss:`; no hace falta `https:` en `connect-src` para el mesh.

**Misma Wi‑Fi desde Pages.** El origen es público, así que Chrome puede pedir permiso de **Red local**. Al unirse, TAZIA prepara ICE (candidatos de red) y deja `iceTransportPolicy: 'all'` salvo que fuerces solo relay. Si el router aísla clientes o denegas el permiso LNA, la LAN no funciona aunque no haga falta TURN.

**Escala.** El mesh degrada ~4–6 peers ([SnoW](https://arxiv.org/pdf/2206.12762)); tope 50, aviso desde 6.

---

## Navegadores y APIs

Stack: **Trystero** (WebRTC + señalización Nostr). Soporte objetivo: Chrome, Brave, Firefox y Safari (desktop + iOS) en HTTPS / localhost.

| Navegador | Nota |
| --- | --- |
| Chrome | WebRTC estable; LNA (*Red local*, 142+) ayuda en misma Wi‑Fi desde origen público. Ed25519 nativo desde **137**; si falta → `@noble/ed25519`. |
| Brave | Mismo motor; *WebRTC IP Handling* puede ocultar host candidates y empeorar mesh LAN. Más ofuscación ≠ mejor P2P. |
| Firefox | WebRTC sólido; sin API LNA. Ed25519 nativo desde **129**. Escritorio ofusca host vía mDNS. |
| Safari | WebRTC desde 11; Ed25519 desde **17**. Por defecto oculta host ICE hasta permiso de captura (TAZIA no pide mic/cam) — misma Wi‑Fi suele necesitar TURN o fallback Nostr. |
| Tor | Fuera de alcance |

### Compatibilidad de APIs

| API | Uso | Chrome / Brave | Firefox | Safari |
| --- | --- | --- | --- | --- |
| `RTCPeerConnection` / DataChannel | Mesh | Sí | Sí | Sí (11+) |
| `permissions` `local-network` | Priming LNA | Sí (Chromium reciente) | No | No |
| `SubtleCrypto` AES-GCM / PBKDF2 / SHA-256 | Frase + fallback | Sí | Sí | Sí |
| `SubtleCrypto` Ed25519 | Firmas + attest | 137+; si no → noble | 129+; si no → noble | 17+; si no → noble |
| `WebSocket` (`wss:`) | Señalización / fallback | Sí | Sí | Sí |
| `navigator.clipboard.writeText` | Copiar invite | Sí | Sí | Sí (gesto); fallback `execCommand` |
| `getUserMedia` + QR | Escanear invite | Sí | Sí | Sí (HTTPS + gesto) |
| `localStorage` / `sessionStorage` | Consentimiento, tema, TURN | Sí | Sí | Sí |
| Screen Wake Lock | Pantalla encendida | Sí | Sí | Parcial |
| `SubtleCrypto` X25519 | Susurro — **obligatorio** | Reciente; si falta → **falla el join** | Reciente | Reciente |

WebRTC sigue siendo la API peer-to-peer. WebTransport es cliente↔servidor; no sustituye el mesh. Hole-punch realista ~70%; el resto necesita TURN ([arXiv:2510.27500](https://arxiv.org/html/2510.27500)).
