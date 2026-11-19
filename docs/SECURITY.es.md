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

---

## Cómo se protege hoy

### Acceso a la zona

La **frase** es la llave: Trystero deriva de ella el cifrado del handshake de descubrimiento. Sin frase no hay red útil entre peers. Por defecto son **6 palabras en español** (~48 bits; lista de 256 términos en `passphraseWords.ts`). Crear o entrar exige una frase suficientemente fuerte (puntuación ≥ good). Hasta **3 zonas** a la vez; tope blando de **50** peers por zona (`MAX_USERS`).

### Identidad

Cada pestaña/zona es un `userId` nuevo (`identity: 'none'`). **Quemar sesión** cierra todos los meshes locales de este dispositivo.

### Mensajes en vivo (WebRTC)

Un `forumMsg` solo se acepta si `authorUserId` coincide con el `userId` Trystero del peer. DTLS **no** cuenta como autoría ([ePrint 2026/584](https://eprint.iacr.org/2026/584)).

Los **Susurros** van sellados (`seal: 2`) con AAD `tazep.dm.aad.v2:…`. Entrar a una zona **exige** SubtleCrypto X25519 en el navegador; si el navegador no lo tiene, el join falla (no hay biblioteca de respaldo). En la red no viaja el texto en claro.

### Cuando WebRTC no llega (fallback Nostr)

Si falla ICE (el navegador no logra la ruta P2P), el chat puede seguir por relés Nostr **cifrados** (PBKDF2 210k + HKDF `tazep/*`; blob `0x03` + AAD `tazep.fallback.aad.v3:{roomId}`; envelope `v: 2`).

Ahí la autenticación es de la aplicación, no del cable WebRTC: los mensajes de foro se aceptan con Ed25519 y la clave **fijada** en el registro (sin inventar un `liveUserId`). La presence exige una attestation firmada `["tazep.presence.v1", …]` antes de fijar TOFU. El goodbye también va atestiguado; las respuestas `sync-res` van firmadas; se comprueba el reloj del EVENT; `schnorr.verify` corre **antes** de descifrar.

La attestation liga claves a un `userId` reclamado (el primero que escribe gana el pin TOFU). **No** equivale al enlace WebRTC de Trystero. Los relés ven metadatos y bytes cifrados — no es P2P puro.

### Sincronización y firmas

Cada evento lleva firma **Ed25519** sobre el payload canónico. La verificación usa la clave SPKI **fijada** hasta un `repin` explícito. Instantáneas sin firma o sin clave conocida se **descartan**.

Reloj: foro y Susurros en vivo ±5 min; sync histórico ±24 h; EVENT Nostr ±300 s.  
Límites blandos: 30 publicaciones/min/peer, 30 Susurros/min, 12 respuestas de sync/min; el sync WebRTC se muestrea a 8 peers. Sync > 2 MB se rechaza (`maxReceiveBytes` ≈ 2.5 MB).

### Confianza entre personas

**WebRTC:** la primera clave vista se fija (TOFU: *trust on first use*) tras la presence de Trystero (mensajes ligados al transporte).  
**Nostr:** solo tras presence atestiguada.  
Código de seguridad (SAS): **6** emojis de un pool de **256** (~48 bits) + binding a `roomId`, derivados de las claves SPKI fijadas ([ePrint 2025/1598](https://eprint.iacr.org/2025/1598)). Si rota la clave → estado `changed`; la verificación sigue en la clave fijada hasta un `repin` explícito (sin “auto-reparar” en silencio).

### Red, consentimiento y burn

Consentimiento de IP la primera vez. Quemar **no** lo borra; «Olvidar este dispositivo» sí.  
La frase en la URL se limpia (`public/scrub-phrase.js` + React).  
TURN es opcional: `sessionStorage` por defecto; `localStorage` solo con opt-in. Burn limpia sessionStorage, **no** el TURN recordado. Detalle: [`TURN.es.md`](TURN.es.md).  
CSP / fuentes: meta CSP + [`../public/_headers`](../public/_headers).

**Quemar sesión** cierra las redes locales, limpia la confianza guardada, borra referencias sensibles, hace `sessionStorage.clear` y recarga. **No** es borrado forense ni denegabilidad práctica ([PoPETs 2025](https://petsymposium.org/popets/2025/popets-2025-0018.pdf)).

---

## Límites honestos

- **Anonimato fuerte** — WebRTC filtra IP (a veces LAN vía mDNS). No fingimos anonimato ([arXiv:2510.16168](https://arxiv.org/abs/2510.16168), [RFC 8828](https://www.rfc-editor.org/rfc/rfc8828.html)).
- **CGNAT sin TURN** — STUN suele fallar detrás de CGNAT ([arXiv:2311.04658](https://arxiv.org/html/2311.04658v2), [arXiv:2510.27500](https://arxiv.org/html/2510.27500)). GitHub Pages no sirve TURN.
- **Anonymity Wrappers** — [ePrint 2025/1619](https://eprint.iacr.org/2025/1619) no implementado.
- **DTLS como prueba de autoría** — no ([ePrint 2026/584](https://eprint.iacr.org/2026/584.pdf)). DTLS ≠ E2E de Susurros.
- **Deniability práctica** — no la reclamamos. Las firmas Ed25519 son atribuibles; burn limpia esta pestaña, no otros dispositivos ni relés.
- **Burn ≠ secure delete** — no se pueden zeroizar `CryptoKey` no extractables; la recarga reduce superficie en RAM.
- **MLS / Double Ratchet / Key Transparency** — necesitan identidad durable u operador de log; incompatibles con `identity: 'none'` + hosting estático puro ([RFC 9420](https://www.rfc-editor.org/rfc/rfc9420)).
- **Tor** — fuera de alcance.
- **Wake Lock** — opcional; mantiene la pantalla, no evita que iOS mate WebRTC al backgroundear.

---

## Despliegue

- Hosting estático: `npm run build` → `dist/`.
- Un solo HTML: `npm run build:single` → `release/tazia-single.html` + `.sha256` (build verificable; cómo abrirlo: [`README.es.md`](../README.es.md)). No sustituye el despliegue multi-archivo de Pages.
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
