# Seguridad — TAZIA

Modelo de amenaza y mitigaciones del foro P2P TAZIA (`agora-forum-v1`, `APP_ID=tazia.app`). Detalle de wire format en [`PROTOCOL.md`](PROTOCOL.md).

## Qué es (y qué no)

**TAZIA** (*Zona Anónima Temporal en Acción*) es una **asamblea en vivo**: el grupo comparte una frase, monta un mesh WebRTC (Trystero) y habla mientras haya pestañas abiertas. No es un messenger asíncrono, no es Tor, no es un servidor de confianza.

## Actores

| Actor | Capacidades asumidas |
| --- | --- |
| Miembro de la banda (conoce la frase) | Entra a la sala, publica, pide/sirve sync |
| Peer malicioso *dentro* de la sala | Puede mentir en UI local; no debe forjar historial ajeno firmado |
| Operador de relé Nostr público | Ve tráfico de *signaling* cifrado; no el foro DTLS |
| Observador de red / STUN | Puede ver IPs de participantes WebRTC |
| Hosting estático | Sirve JS/CSS; no almacena mensajes |

## Mitigaciones actuales

1. **Frase de sala** — Trystero deriva cifrado del handshake de descubrimiento (`password`). Sin frase no hay mesh útil.
2. **Identidad efímera** — `identity: 'none'`: cada pestaña es un `userId` nuevo; «quemar sesión» cierra el mesh.
3. **Autoría en vivo** — `forumMsg` solo se acepta si `authorUserId` coincide con el `userId` Trystero del peer (handshake de identidad de la librería).
4. **Sync verificable** — Cada evento lleva firma **Ed25519** sobre el payload canónico. La pubkey se publica en `makeUserState('presence')`. Snapshots sin firma válida o sin clave conocida se **descartan** (contador discreto en Presentes).
5. **Reloj** — `createdAtMs` fuera de ±24 h se rechaza (anti-spam básico).
6. **Rate-limit blando** — Máx. 30 publicaciones/minuto por peer (local).
7. **Consentimiento IP** — Modal la primera vez (`localStorage` `tazia-ip-consent`). Salir de la pestaña **no** borra el consentimiento; «Olvidar este dispositivo» en Ayuda sí.
8. **Scrub de frase en URL** — Tras parsear `#sala~frase`, el hash queda en `#sala`.
9. **CSP / fuentes** — Meta CSP + [`public/_headers`](public/_headers); fuentes self-hosted (sin Google Fonts).

## Límites honestos (no-goals de este ciclo)

- **Metadata / anonimato fuerte** — WebRTC filtra IP (y a veces LAN vía mDNS). No fingimos anonimato; ver [arXiv:2510.16168](https://arxiv.org/abs/2510.16168) y [RFC 8828](https://www.rfc-editor.org/rfc/rfc8828.html).
- **Anonymity Wrappers** — [AW CCS’25 / ePrint 2025/1619](https://eprint.iacr.org/2025/1619) describe ocultación genérica de metadata; **no** implementado aquí.
- **Confiar ciegamente en DTLS-SRTP** — [ePrint 2026/584](https://eprint.iacr.org/2026/584.pdf) muestra fallos de auth en ecosistemas WebRTC; mantenemos dependencia del handshake de identidad de Trystero y firmas de aplicación.
- **Infra no confiable como Cwtch** — El diseño «banda + frase + sync documentado» se inspira en [Cwtch](https://cwtch.im/cwtch.pdf) / [docs](https://docs.cwtch.im/), pero sin su stack de transporte.
- **MLS / OpenMLS** — Grupos con MLS (WASM) quedan como **roadmap** (Lupyd, hush-crypto, OpenMLS); no en este ciclo.
- **Tor / TURN propio** — Fuera de alcance; NAT agresivo puede fallar sin TURN.

## Despliegue

- Hosting estático (`npm run build` → `dist/`).
- Cabeceras sugeridas (además o en lugar del meta CSP):

```
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https: wss:; worker-src 'self' blob:;
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
```


Ajusta `connect-src` a los hosts concretos de relés Nostr si quieres una CSP más cerrada tras probar el mesh.
