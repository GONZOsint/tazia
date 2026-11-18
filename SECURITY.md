# Seguridad — TAZIA

Modelo de amenaza y mitigaciones del foro P2P TAZIA (`agora-forum-v1`, `APP_ID=tazia.app`). Detalle de wire format en [`PROTOCOL.md`](PROTOCOL.md).

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

1. **Frase de zona** — Trystero deriva cifrado del handshake de descubrimiento (`password`). Sin frase no hay mesh útil. Puedes mantener hasta **5 zonas** concurrentes en un navegador (una vista activa).
2. **Identidad efímera** — `identity: 'none'`: cada pestaña/zona es un `userId` nuevo; **quemar sesión** cierra todos los meshes locales.
3. **Autoría en vivo** — `forumMsg` solo se acepta si `authorUserId` coincide con el `userId` Trystero del peer (handshake de identidad de la librería).
4. **Sync verificable** — Cada evento lleva firma **Ed25519** sobre el payload canónico. La pubkey se publica en `makeUserState('presence')`. Snapshots sin firma válida o sin clave conocida se **descartan** (contador discreto en Presentes).
5. **Reloj** — mensajes en vivo ±5 min (`LIVE_CLOCK_SKEW_MS`); sync histórico ±24 h (`SYNC_CLOCK_SKEW_MS`).
6. **Rate-limit blando** — Máx. 30 publicaciones/minuto por peer (local), con `pruneStale` en sesiones largas.
7. **Límite de sync** — respuestas sync > 2 MB se rechazan (`MAX_SYNC_TOTAL_BYTES`), también en el path Nostr fallback; rate-limit de respuestas sync por peer.
8. **TOFU + SAS emoji** — se pinnea la clave de firma al primer uso; código de 4 emojis (SHA-256 de claves ordenadas) para verificación OOB; alerta si la clave cambia. Alineado con [ePrint 2025/1598](https://eprint.iacr.org/2025/1598) / [RFC 8826](https://datatracker.ietf.org/doc/html/rfc8826); 4 emojis ≈ 24 bit (roadmap: alargar).
9. **Consentimiento IP** — Modal la primera vez (`localStorage` `tazia-ip-consent`). Quemar sesión **no** borra el consentimiento; «Olvidar este dispositivo» en Ayuda sí.
10. **Scrub de frase en URL** — Tras parsear `#zona~frase` (`roomId` técnico), el hash queda en `#zona`.
11. **TURN opcional** — STUN por defecto; TURN self-hosted como fallback ICE o `relay`-only ([`TURN.md`](TURN.md)).
12. **CSP / fuentes** — Meta CSP + [`public/_headers`](public/_headers); `connect-src 'self' wss:`; `font-src 'self' data:`; sin Google Fonts.

## Límites honestos (no-goals)

- **Metadata / anonimato fuerte** — WebRTC filtra IP (y a veces LAN vía mDNS). No fingimos anonimato; ver [arXiv:2510.16168](https://arxiv.org/abs/2510.16168) y [RFC 8828](https://www.rfc-editor.org/rfc/rfc8828.html).
- **CGNAT sin TURN** — STUN suele fallar detrás de CGNAT residencial ([arXiv:2311.04658](https://arxiv.org/html/2311.04658v2), [arXiv:2510.27500](https://arxiv.org/html/2510.27500)). GitHub Pages no sirve TURN.
- **Anonymity Wrappers** — [AW CCS’25 / ePrint 2025/1619](https://eprint.iacr.org/2025/1619) **no** implementado.
- **Confiar ciegamente en DTLS-SRTP** — [ePrint 2026/584](https://eprint.iacr.org/2026/584.pdf); mantenemos identidad Trystero + firmas de aplicación.
- **Infra no confiable como Cwtch** — inspiración de diseño, sin su stack de transporte.
- **MLS / OpenMLS** — roadmap; no en este ciclo.
- **Tor** — fuera de alcance.

## Despliegue

- Hosting estático (`npm run build` → `dist/`).
- Cabeceras sugeridas (además o en lugar del meta CSP):

```
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' wss:; worker-src 'self' blob:;
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(self), microphone=(), geolocation=(), local-network=(self), loopback-network=(self)
```

Los relés Nostr de Trystero usan `wss:`; no hace falta `https:` en `connect-src` para el mesh.

**Misma LAN desde GitHub Pages:** el origen es público (`https://…github.io`), así que Chrome puede pedir permiso **Red local** (`local-network`) para candidatos host/mDNS. TAZIA hace priming ICE al unirse y deja `iceTransportPolicy: 'all'` salvo force-relay. Aislamiento de AP/clientes o LNA denegado bloquean LAN aunque no haga falta TURN.

**Fallback Nostr (Pages / CGNAT):** si ICE falla tras intercambiar SDP, el chat/presencia/DM siguen por eventos Nostr **cifrados AES-GCM** con la frase de zona (además de la firma Ed25519). Los operadores de relé ven metadatos y ciphertext, no el texto en claro. No es P2P puro; TURN propio sigue siendo el camino para mesh WebRTC. El mesh completo degrada con muchos peers ([SnoW](https://arxiv.org/pdf/2206.12762)); TAZIA está pensada para grupos pequeños.

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
| `SubtleCrypto` Ed25519 | Firmas de autoría | 137+; si no → `@noble/ed25519` | 129+; si no → noble | 17+; si no → noble |
| `WebSocket` (`wss:`) | Señalización / fallback Nostr | Sí | Sí | Sí |
| `navigator.clipboard.writeText` | Copiar invite | Sí | Sí | Sí (gesto); fallback `execCommand` |
| `getUserMedia` + QR (`cam2qr`) | Escanear invite | Sí | Sí | Sí (HTTPS + gesto; `playsInline`) |
| `localStorage` | Consentimiento IP, tema, TURN | Sí | Sí | Sí |

- **WebRTC** sigue siendo la API peer-to-peer ([W3C WebRTC](https://www.w3.org/TR/webrtc), [RFC 8826](https://datatracker.ietf.org/doc/html/rfc8826)).
- **WebTransport** es cliente↔servidor HTTP/3, no sustituye mesh entre navegadores ([Chrome WebTransport](https://developer.chrome.com/docs/capabilities/web-apis/webtransport)).
- Hole-punch realista ~70%; el resto necesita TURN ([arXiv:2510.27500](https://arxiv.org/html/2510.27500)).
