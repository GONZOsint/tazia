# Seguridad — TAZIA

Español · [English](SECURITY.md)

Modelo de amenaza y mitigaciones del foro P2P TAZIA (**TAZEP** `tazep-v2`, `APP_ID=tazia.app`). Wire format: [`PROTOCOL.es.md`](PROTOCOL.es.md). TURN / ICE: [`TURN.es.md`](TURN.es.md). Papers locales: [`papers/`](papers/).

## Qué es (y qué no)

**TAZIA** (*Zona Anónima Temporal en Acción*) es una **asamblea en vivo**: el grupo comparte una frase, monta un mesh WebRTC (Trystero) y habla mientras haya pestañas abiertas. No es un messenger asíncrono, no es Tor, no es un servidor de confianza.

## Actores

| Actor | Capacidades asumidas |
| --- | --- |
| Miembro de la banda (conoce la frase) | Entra a la zona, publica, pide/sirve sync |
| Peer malicioso *dentro* de la zona | Puede mentir en UI local; no debe forjar historial ajeno firmado |
| Operador de relé Nostr público | Ve signaling cifrado; si hay fallback de datos, también ciphertext AES-GCM (no texto en claro) |
| Observador de red / STUN | Puede ver IPs de participantes WebRTC |
| Operador TURN (si se configura) | Ve IP y tráfico WebRTC cifrado; no puede forjar firmas de app |
| Hosting estático | Sirve JS/CSS; no almacena mensajes |

## Mitigaciones actuales

1. **Frase de zona** — Trystero deriva cifrado del handshake de descubrimiento (`password`). Sin frase no hay mesh útil. Default memorable **6 palabras en español** (~48 bits; wordlist de 256 términos únicos en `passphraseWords.ts`); create/join exigen `isAcceptable` (score ≥ good). Hasta **3 zonas** concurrentes; tope blando **50** peers/zona (`MAX_USERS`).
2. **Identidad efímera** — `identity: 'none'`: cada pestaña/zona es un `userId` nuevo; **quemar sesión** cierra todos los meshes locales.
3. **Autoría en vivo (WebRTC)** — `forumMsg` solo se acepta si `authorUserId` coincide con el `userId` Trystero del peer. DTLS **no** cuenta como autoría ([ePrint 2026/584](https://eprint.iacr.org/2026/584)).
4. **Fallback Nostr — binding de aplicación** — Forum ingest **sin** `liveUserId` falso (Ed25519 + registry **pinned**). Presence Nostr exige attestation `["tazep.presence.v1", …]` antes de TOFU. La attestation liga claves a un `userId` reclamado (TOFU first-writer); **no** equivale al binding WebRTC de Trystero. Goodbye atestiguado; `sync-res` firmado; skew de EVENT; schnorr.verify antes de decrypt.
5. **Sync verificable** — Firma **Ed25519** canónica; verify usa SPKI **pinned** hasta `repin`. Snapshots sin firma/clave se **descartan**.
6. **Reloj** — foro + Susurros en vivo ±5 min; sync histórico ±24 h; EVENT Nostr ±300 s.
7. **Rate-limit blando** — Máx. 30 pubs/min/peer (live/fallback/sync); 30 Susurros/min; 12 sync answers/min; sample WebRTC a 8 peers.
8. **Límite de sync** — > 2 MB rechazado; `maxReceiveBytes` ≈ 2.5 MB.
9. **TOFU + SAS emoji** — **WebRTC:** pin tras presence Trystero (ingest ligado al transporte). **Nostr:** solo tras presence atestiguada. SAS: **6** emojis de un pool **único de 256** (~48 bits) + binding `roomId`, desde SPKIs **pinned** ([ePrint 2025/1598](https://eprint.iacr.org/2025/1598)). Rotación → `changed`; verify sigue pinned hasta `repin` (sin auto-heal).
10. **Consentimiento IP** — Modal la primera vez. Quemar **no** borra consentimiento; «Olvidar este dispositivo» sí.
11. **Scrub de frase en URL** — `public/scrub-phrase.js` + React.
12. **TURN opcional** — sessionStorage por defecto; localStorage solo con opt-in. Burn limpia sessionStorage, **no** el TURN persistido. Ver [`TURN.es.md`](TURN.es.md).
13. **CSP / fuentes** — Meta CSP + [`../public/_headers`](../public/_headers).
14. **Fallback Nostr (cifrado)** — PBKDF2 210k + HKDF `tazep/*`; blob `0x03` + AAD `tazep.fallback.aad.v3:{roomId}`; envelope `v: 2`.
15. **Susurros** — **sealed-only** (`seal: 2`); AAD `tazep.dm.aad.v2:…`; join **exige SubtleCrypto X25519** (sin polyfill noble — falla el join); sin plaintext en el wire.
16. **Quemar sesión** — cierra meshes, limpia trust, wipe, `sessionStorage.clear`, recarga. **No** es secure delete ni deniability práctica ([PoPETs 2025](https://petsymposium.org/popets/2025/popets-2025-0018.pdf)).

## Límites honestos (no-goals)

- **Metadata / anonimato fuerte** — WebRTC filtra IP (y a veces LAN vía mDNS). No fingimos anonimato; ver [arXiv:2510.16168](https://arxiv.org/abs/2510.16168) y [RFC 8828](https://www.rfc-editor.org/rfc/rfc8828.html).
- **CGNAT sin TURN** — STUN suele fallar detrás de CGNAT residencial ([arXiv:2311.04658](https://arxiv.org/html/2311.04658v2), [arXiv:2510.27500](https://arxiv.org/html/2510.27500)). GitHub Pages no sirve TURN.
- **Anonymity Wrappers** — [AW CCS’25 / ePrint 2025/1619](https://eprint.iacr.org/2025/1619) **no** implementado.
- **Confiar ciegamente en DTLS-SRTP** — [ePrint 2026/584](https://eprint.iacr.org/2026/584.pdf); mantenemos identidad Trystero + firmas de aplicación. DTLS ≠ E2E de Susurros entre dos personas.
- **Deniability práctica** — No la reclamamos. Firmas Ed25519 en eventos locales son atribuibles en la práctica; burn limpia la pestaña, no borra evidencia en otros dispositivos ni en relés ([PoPETs 2025 deniability](https://petsymposium.org/popets/2025/popets-2025-0018.pdf)).
- **Burn ≠ secure delete** — no se pueden zeroizar `CryptoKey` no extractables; la recarga reduce superficie en RAM de la pestaña.
- **MLS / OpenMLS / Double Ratchet / Key Transparency** — requieren identidad durable y/o operador de log; incompatibles con `identity: 'none'` + hosting estático puro. Roadmap lejano, no este ciclo ([RFC 9420](https://www.rfc-editor.org/rfc/rfc9420), [KT draft](https://datatracker.ietf.org/doc/html/draft-ietf-keytrans-architecture-05)).
- **Infra no confiable como Cwtch** — inspiración de diseño, sin su stack de transporte.
- **Tor** — fuera de alcance.
- **Wake Lock** — opcional; mantiene la pantalla encendida, **no** evita que iOS mate WebRTC al backgroundear.

## Despliegue

- Hosting estático (`npm run build` → `dist/`).
- **Single-file (P3):** `npm run build:single` → `release/tazia-single.html` + `.sha256` (artefacto verificable; no sustituye Pages multi-asset por defecto).
- Spike SDP/QR manual: [`sdp-qr-spike.es.md`](sdp-qr-spike.es.md) (no empaquetado; no sustituye Trystero).
- Cabeceras sugeridas (además o en lugar del meta CSP):

```
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' wss:; worker-src 'self' blob:;
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(self), microphone=(), geolocation=(), local-network=(self), loopback-network=(self)
```

Los relés Nostr de Trystero usan `wss:`; no hace falta `https:` en `connect-src` para el mesh.

**Misma LAN desde GitHub Pages:** el origen es público (`https://…github.io`), así que Chrome puede pedir permiso **Red local** (`local-network`) para candidatos host/mDNS. TAZIA hace priming ICE al unirse y deja `iceTransportPolicy: 'all'` salvo force-relay. Aislamiento de AP/clientes o LNA denegado bloquean LAN aunque no haga falta TURN.

**Fallback Nostr (Pages / CGNAT):** chat/presencia/DM por Nostr cifrado AES-GCM (firma Ed25519 aparte + attestation de presence + verify EVENT). Relés ven metadatos y ciphertext. No es P2P puro. Mesh degrada ~4–6 peers ([SnoW](https://arxiv.org/pdf/2206.12762)); tope 50, aviso desde 6.

## Navegadores y APIs (SOTA)

Stack: **Trystero** (WebRTC + señalización Nostr). No forkear Trystero/Nostr ni migrar a js-libp2p en hosting estático puro.

Soporte objetivo: **Chrome**, **Brave**, **Firefox**, **Safari** (desktop + iOS WebKit) en contexto seguro (HTTPS / localhost).

| Navegador | Nota para TAZIA |
| --- | --- |
| Chrome | WebRTC + DataChannel estables; LNA (permiso *Red local*, Chrome 142+) ayuda misma Wi‑Fi desde origen público ([Chrome LNA](https://developer.chrome.com/blog/local-network-access)). Ed25519 nativo en SubtleCrypto desde **137** ([Can I use](https://caniuse.com/mdn-api_subtlecrypto_generatekey_ed25519)); TAZIA usa `@noble/ed25519` si falta. |
| Brave | Mismo motor Chromium/WebRTC; política *WebRTC IP Handling* puede ocultar host candidates y empeorar mesh LAN ([Brave WebRTC settings](https://github.com/brave/brave-browser/wiki/WebRTC-Custom-Settings)). Más ofuscación ≠ mejor P2P ([arXiv:2510.16168](https://arxiv.org/abs/2510.16168)). |
| Firefox | WebRTC sólido; sin API LNA. Ed25519 nativo desde **129**. Escritorio ofusca host vía mDNS; `about:webrtc` para diagnóstico. |
| Safari | WebRTC desde 11; Ed25519 nativo desde **17**. Por defecto **oculta host ICE** hasta permiso de captura (TAZIA no pide mic/cam) — misma Wi‑Fi suele necesitar TURN o fallback Nostr cifrado. Clipboard/`getUserMedia` exigen gesto de usuario más estricto en iOS. |
| Tor | Fuera de alcance; bloquea fugas WebRTC pero no es el modelo de TAZIA |

### APIs usadas y compatibilidad

| API | Uso en TAZIA | Chrome / Brave | Firefox | Safari |
| --- | --- | --- | --- | --- |
| `RTCPeerConnection` / DataChannel | Mesh Trystero | Sí ([Can I use RTCPeerConnection](https://caniuse.com/rtcpeerconnection)) | Sí | Sí (11+) |
| `permissions` `local-network` | Priming LNA | Sí (Chromium reciente) | No | No |
| `SubtleCrypto` AES-GCM / PBKDF2 / SHA-256 | Frase de sala + fallback Nostr | Sí | Sí | Sí |
| `SubtleCrypto` Ed25519 | Firmas de autoría + presence attest | 137+; si no → `@noble/ed25519` | 129+; si no → noble | 17+; si no → noble |
| `WebSocket` (`wss:`) | Señalización / fallback Nostr | Sí | Sí | Sí |
| `navigator.clipboard.writeText` | Copiar invite | Sí | Sí | Sí (gesto); fallback `execCommand` |
| `getUserMedia` + QR (`cam2qr`) | Escanear invite | Sí | Sí | Sí (HTTPS + gesto; `playsInline`) |
| `localStorage` / `sessionStorage` | Consentimiento IP, tema; TURN (session por defecto) | Sí | Sí | Sí |
| Screen Wake Lock | Mantener pantalla (opcional) | Sí | Sí | Parcial |
| `SubtleCrypto` X25519 | Susurro pairwise — **obligatorio** en join | Reciente; si falta → **falla el join** (sin polyfill noble) | Reciente | Reciente |

- **WebRTC** sigue siendo la API peer-to-peer ([W3C WebRTC](https://www.w3.org/TR/webrtc), [RFC 8826](https://datatracker.ietf.org/doc/html/rfc8826)).
- **WebTransport** es cliente↔servidor HTTP/3, no sustituye mesh entre navegadores ([Chrome WebTransport](https://developer.chrome.com/docs/capabilities/web-apis/webtransport)).
- Hole-punch realista ~70%; el resto necesita TURN ([arXiv:2510.27500](https://arxiv.org/html/2510.27500)).
