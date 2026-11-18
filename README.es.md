# TAZIA

**Zona Anónima Temporal en Acción** (*Temporary Anonymous Zone In Action*)

Zona temporal en el navegador: sin cuentas ni servidor nuestro de mensajes. Comparte una frase, hablad mientras estéis online, **quema la sesión** al acabar. En el móvil puedes **Instalar / Añadir a inicio** (PWA) para un shell tipo app — la plaza sigue necesitando red y peers vivos.

Stack: [React](https://react.dev/) + [Vite](https://vite.dev/) + [Trystero 0.27](https://trystero.dev/). Protocolo: `agora-forum-v1` (eventos firmados Ed25519). App ID: `tazia.app`.

README principal (inglés): [`README.md`](README.md).

## Uso rápido

1. Abre el sitio (local o hosting estático).
2. **Abre una zona** y genera una frase memorable.
3. Di la frase en persona / en papel. Opcional: meterla en el enlace `#` (más cómodo, más arriesgado).
4. Comparte el enlace o el QR (el QR se genera **en el navegador**; también puedes **escanear** un QR para unirte).
5. La primera entrada pide **consentimiento de dirección de red**.
6. Al acabar: **Quemar sesión**.

Tenéis que estar **online a la vez**. No hay buzón asíncrono.

### Funciones

- **Varias zonas a la vez** (máx. **5**): cada una mantiene su sesión P2P; **Zonas** las lista; cambia o sal de una; Plaza / Tribu / Susurros muestran la zona **activa**; **Quemar** borra todas en este dispositivo
- Susurros (mensajes directos firmados) en la zona activa
- Confianza TOFU + códigos de 6 emojis ligados a `roomId` (Tribu)
- TURN opcional autoalojado (rescate ICE / ocultar IP) — [`TURN.md`](TURN.md)

### Varias zonas

Entra a la zona A y luego abre o entra a la B sin tumbar A (espera a que termine el primer join). Usa **Cambiar** en la lista de Zonas. Salir quita solo esa zona; Quemar destruye todas en este navegador. El mesh va mejor en grupos pequeños (~5 peers).

### ICE failed / CGNAT / misma Wi‑Fi en Pages

Si Firefox muestra `WebRTC: ICE failed, add a TURN server`, STUN no puede atravesar tu NAT (habitual con CGNAT residencial). Opciones:

1. Misma **Wi‑Fi** (candidatos host/mDNS) — en Pages, permite **Red local** si Chrome lo pide; sin aislamiento de AP; **Forzar relay** apagado.
2. Tu propio **coturn** y activar TURN en Zonas (ambos peers).

Helpers en JS: `iceCandidatePoolSize`, `turnConfig`, priming LNA, y **fallback de datos cifrado por Nostr** si falla ICE para que el chat siga en Pages sin TURN (no es P2P puro; los relés ven ciphertext). TURN propio sigue siendo el camino para mesh real. Detalle: [`TURN.md`](TURN.md).

## Desarrollo

```bash
npm install
npm run dev
```

| Script | Qué hace |
| --- | --- |
| `npm run build` | Build estático → `dist/` |
| `npm run build:single` | HTML único + SHA-256 en `release/` |
| `npm run preview` | Sirve el build |
| `npm run lint` | `tsc --noEmit` |

Para probar en la red local, Vite escucha en todas las interfaces (`host: true`). En Windows, permite `node.exe` o el puerto `5173` en el firewall si la red es **Pública**. URL de desarrollo: `http://localhost:5173/tazia/`.

## Documentación

- [`SECURITY.md`](SECURITY.md) — modelo de amenaza, TOFU, CSP, límites honestos.
- [`PROTOCOL.md`](PROTOCOL.md) — formato wire `agora-forum-v1`.
- [`TURN.md`](TURN.md) — coturn autoalojado + checklist ICE failed.

## Lecturas

| Fuente | Relevancia |
| --- | --- |
| [Cwtch](https://cwtch.im/cwtch.pdf) / [docs](https://docs.cwtch.im/) | Infra no confiable + detección de fallos |
| [AW CCS’25 / ePrint 2025/1619](https://eprint.iacr.org/2025/1619) | Ocultación de metadata (no implementado) |
| [WebRTC IP leakage 2025](https://arxiv.org/abs/2510.16168) + [RFC 8828](https://www.rfc-editor.org/rfc/rfc8828.html) | UX de consentimiento IP |
| [ePrint 2026/584](https://eprint.iacr.org/2026/584.pdf) | No tratar DTLS solo como autoría |
| [ePrint 2025/1598](https://eprint.iacr.org/2025/1598) SAS + OOB | Valida verify por emojis; usamos 6 de un pool ≥256 + binding `roomId` |
| [RFC 8826](https://datatracker.ietf.org/doc/html/rfc8826) | Seguridad WebRTC; TOFU débil sin OOB |
| [arXiv:2510.27500](https://arxiv.org/html/2510.27500) DCUtR NAT | Hole-punch ~70%; TURN sigue siendo fallback |
| [arXiv:2311.04658](https://arxiv.org/html/2311.04658v2) CGNAT | Por qué falla ICE residencial sin TURN |
| [SnoW serverless n-party WebRTC](https://arxiv.org/pdf/2206.12762) | El mesh completo degrada >~4–6 peers — zonas pequeñas |
| [CRDT P2P WebRTC VR](https://arxiv.org/html/2503.17826v1) | Sync tipado eventual por data channels (futuro; hoy merge firmado) |
| [Delta Chat realtime P2P](https://delta.chat/en/2024-11-20-webxdc-realtime) | Canales efímeros — varias zonas independientes encajan |
| [Chrome LNA](https://developer.chrome.com/blog/local-network-access) | Permiso red local (misma Wi‑Fi en Pages) |
| [WebTransport](https://developer.chrome.com/docs/capabilities/web-apis/webtransport) | Solo cliente–servidor — no sustituye mesh P2P |
| OpenMLS / WASM | Roadmap de grupos |

**Navegadores:** Chrome, Brave, Firefox y Safari (HTTPS). Ed25519 usa Web Crypto nativo si existe; si no, `@noble/ed25519`. La política WebRTC de Brave y los host ICE ocultos de Safari pueden empeorar el mesh en la misma Wi‑Fi — TURN o el fallback Nostr cifrado lo cubren. Seguimos con **Trystero**; sin fork de Nostr/Trystero para Pages.

## GitHub Pages

Sitio público: `https://gonzosint.github.io/tazia/` (`base: '/tazia/'` en Vite). El workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) construye `dist/` y lo publica en la rama `gh-pages` en cada push a `master`.

No sirve el `index.html` fuente: hace falta el build.

## Cabeceras de despliegue

Ver [`public/_headers`](public/_headers) (estilo Netlify). Preferir CSP por HTTP frente a meta; las fuentes van self-hosted. `frame-ancestors` solo aplica por cabecera HTTP (GitHub Pages no aplica `_headers`).
