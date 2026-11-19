# TURN autoalojado para TAZIA

Español · [English](TURN.md)

Por defecto, los peers de TAZIA se conectan directamente (P2P asistido por STUN). Muchos NAT domésticos
(sobre todo CGNAT) **no pueden** completar ICE solo con STUN — Firefox muestra
`WebRTC: ICE failed, add a TURN server`.

TURN retransmite el tráfico cuando fallan las rutas directas. Opcionalmente puedes **forzar solo relay**
para ocultar también tu IP a los peers.

Las etiquetas de UI en inglés son **Fix** / **Use TURN as fallback** / **Force relay only**; en español: **Arreglar** / **Usar TURN como respaldo** / **Solo retransmisión**.

## ¿Por qué TURN?

| Modo | Conectar tras CGNAT | Tu IP visible a peers | Latencia |
|------|---------------------|-----------------------|----------|
| Por defecto (STUN/P2P) | Suele fallar | Sí | Baja |
| TURN como respaldo | Sí | Sí (hasta usar relay) | Baja / mayor si relay |
| TURN solo relay | Sí | No (solo IP del TURN) | Mayor |

## Inicio rápido con Docker (coturn)

```bash
docker run -d \
  --name coturn \
  --network host \
  coturn/coturn \
  -n \
  --realm=tazia.app \
  --listening-port=3478 \
  --min-port=49152 \
  --max-port=65535 \
  --user=tazia:your-secret-password \
  --lt-cred-mech \
  --no-tls \
  --no-dtls \
  --fingerprint
```

> **Nota:** En producción, activa TLS (`--cert`, `--pkey`, `--tls-listening-port=5349`)
> y restringe rangos de peers según tu red.

## Configurar en TAZIA

1. Abre la pestaña **Zonas**.
2. Expande **Arreglar** · *¿No llegáis a conectar?* (se abre solo tras errores de peer-connect / ICE).
3. Activa **Usar TURN como respaldo**.
4. Introduce los datos del servidor:
   - **URL:** `turn:your-server.example.com:3478`
   - **Usuario:** `tazia`
   - **Credencial:** `your-secret-password`
5. Opcional: activa **Solo retransmisión** para ocultar tu IP (requiere TURN funcionando).
6. Crea o únete a una zona — **ambos** peers necesitan la misma config TURN, luego vuelve a entrar.

Las credenciales quedan en **`sessionStorage` por defecto** (desaparecen al cerrar la pestaña). El opt-in **Recordar en este dispositivo** las guarda en `localStorage`. No se envían al hosting de TAZIA.

## Verificar modo solo relay

1. Activa **Solo retransmisión** con un TURN que funcione.
2. Abre `chrome://webrtc-internals/` (Chrome/Brave) o `about:webrtc` (Firefox).
3. Confirma que los candidatos ICE activos son tipo `relay` (sin ruta útil `host` / `srflx`).

## ICE failed en GitHub Pages / CGNAT — checklist

Síntoma: `WebRTC: ICE failed, add a TURN server and see about:webrtc`

### Sin TURN en GitHub Pages

Cuando falla ICE tras el intercambio SDP, TAZIA aún puede llevar foro / DM / presencia
**cifrados** por relés Nostr de descubrimiento (AES-GCM con la frase de zona).
Deberías ver un aviso de que la ruta por relé está activa — el chat funciona, pero
**no** es un mesh directo. TURN propio sigue siendo el camino para WebRTC P2P real.

### Misma Wi‑Fi (P2P real sin TURN)

1. Ambos peers abren la **misma** URL de Pages y entran con la **misma** frase.
2. Chrome/Edge/Brave: si te lo pide, **Permitir Red local** (origen público → LAN). Si lo denegaste antes: ajustes del sitio → Red local → Permitir, y vuelve a entrar.
3. Router: desactiva **aislamiento AP / clientes** / Wi‑Fi de invitados que bloquee peer-to-peer.
4. Deja **Solo retransmisión** desmarcado (relay-only elimina candidatos host).
5. Mira `chrome://webrtc-internals` / `about:webrtc` en busca de candidatos `host` o `*.local`.

### Redes distintas / CGNAT

1. Abre `about:webrtc` o `chrome://webrtc-internals` — busca candidatos `relay` ausentes.
2. En TAZIA → **Zonas** → expande **Arreglar**.
3. Activa **Usar TURN como respaldo**, introduce URL / usuario / contraseña de coturn.
4. **Ambos** peers deben usar la misma config TURN y volver a entrar.
5. **No** actives **Solo retransmisión** hasta confirmar que TURN funciona.
6. Firewall de Windows: red Privada + Permitir entrada para el navegador (UDP) ayuda al P2P directo; TURN solo necesita salida hacia tu servidor.

Referencias: [Chrome LNA](https://developer.chrome.com/blog/local-network-access), [arXiv:2311.04658](https://arxiv.org/html/2311.04658v2) (CGNAT), [arXiv:2510.27500](https://arxiv.org/html/2510.27500) (baselines de NAT traversal).

## Notas de seguridad

- TURN oculta tu IP a los peers, pero el operador TURN ve tu IP. Usa un servidor de confianza (idealmente el tuyo).
- Los mensajes de la app van firmados con Ed25519. TURN no puede forjar firmas; sí puede ver tráfico WebRTC cifrado.
- TAZIA **no** incluye un TURN de terceros; autoalójalo o usa uno que controles.
- **Quemar sesión** limpia `sessionStorage` (TURN por defecto). El opt-in **Recordar en este dispositivo** (`localStorage`) sobrevive al burn hasta borrar datos del sitio o desmarcar recordar.
- Ver también [`SECURITY.es.md`](SECURITY.es.md) (modelo de amenaza) y el fallback de datos cifrado por Nostr cuando falla ICE.
