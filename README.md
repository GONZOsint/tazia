# TAZIA

**Zona Anónima Temporal en Acción** (*Temporary Anonymous Zone In Action*)

Charla temporal en el navegador: sin cuentas ni servidor nuestro de mensajes. Comparte una frase, hablad mientras estéis online, salid al acabar.

Stack: [React](https://react.dev/) + [Vite](https://vite.dev/) + [Trystero 0.27](https://trystero.dev/). Protocolo: `agora-forum-v1` (eventos firmados Ed25519). App ID: `tazia.app`.

## Uso rápido

1. Abre el sitio (local o hosting estático).
2. **Crea una sala** y genera una frase memorable.
3. Di la frase en persona / en papel. Opcional: meterla en el enlace `#` (más cómodo, más arriesgado).
4. Comparte el enlace o el QR (el QR se genera **en el navegador**).
5. La primera entrada pide **consentimiento de dirección de red**.
6. Al acabar: **Salir de esta pestaña**.

Tenéis que estar **online a la vez**. No hay buzón asíncrono.

## Desarrollo

```bash
npm install
npm run dev
```

| Script | Qué hace |
| --- | --- |
| `npm run build` | Build estático → `dist/` |
| `npm run preview` | Sirve el build |
| `npm run lint` | `tsc --noEmit` |

Para probar en la red local, `vite` escucha en todas las interfaces (`host: true`). En Windows, permite `node.exe` o el puerto `5173` en el firewall si la red es **Pública**.

## Documentación

- [`SECURITY.md`](SECURITY.md) — modelo de amenaza, CSP, no-goals (Tor/MLS).
- [`PROTOCOL.md`](PROTOCOL.md) — formato wire `agora-forum-v1`.

## Lecturas

| Fuente | Relevancia |
| --- | --- |
| [Cwtch](https://cwtch.im/cwtch.pdf) / [docs](https://docs.cwtch.im/) | Infra no confiable + detección de fallos |
| [AW CCS’25 / ePrint 2025/1619](https://eprint.iacr.org/2025/1619) | Ocultación de metadata (no implementado) |
| [WebRTC IP leakage 2025](https://arxiv.org/abs/2510.16168) + [RFC 8828](https://www.rfc-editor.org/rfc/rfc8828.html) | UX de consentimiento IP |
| [ePrint 2026/584](https://eprint.iacr.org/2026/584.pdf) | No tratar DTLS solo como autoría |
| OpenMLS / WASM | Roadmap de grupos |

## GitHub Pages

El sitio público está en `https://gonzosint.github.io/tazia/` (`base: '/tazia/'` en Vite). El workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) construye `dist/` y lo publica en cada push a `master`.

No sirve el `index.html` fuente: hace falta el build. En desarrollo local la app queda en `http://localhost:5173/tazia/`.

## Cabeceras de despliegue

Ver [`public/_headers`](public/_headers) (estilo Netlify). Preferir CSP por HTTP frente a meta; las fuentes van self-hosted. `frame-ancestors` solo aplica por cabecera HTTP (GitHub Pages no la envía).
