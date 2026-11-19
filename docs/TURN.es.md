# Conexión y TURN — TAZIA

Español · [English](TURN.md)

Por defecto los dispositivos se encuentran en directo (P2P con ayuda de STUN). En muchos hogares —sobre todo detrás de **CGNAT** (varios vecinos comparten la misma IP pública)— eso no basta: el navegador muestra `WebRTC: ICE failed, add a TURN server`.

**TURN** es un servidor intermedio que retransmite el tráfico cuando falla la ruta directa. Opcionalmente puedes **forzar solo relay** para ocultar también tu IP a los demás peers.

En la UI: **Arreglar** · **Usar TURN como respaldo** · **Solo retransmisión**  
(en inglés: Fix / Use TURN as fallback / Force relay only).

---

## Cuándo hace falta

| Modo | Detrás de CGNAT | IP visible a peers | Latencia |
| --- | --- | --- | --- |
| Por defecto (STUN/P2P) | Suele fallar | Sí | Baja |
| TURN como respaldo | Sí | Sí (hasta usar relay) | Baja / mayor si relay |
| TURN solo relay | Sí | No (solo IP del TURN) | Mayor |

Si estáis en la **misma Wi‑Fi**, a menudo no hace falta TURN: basta permitir red local y desactivar el aislamiento de clientes del router. Si estáis en redes distintas o CGNAT, un TURN propio es el camino a WebRTC real.

---

## Coturn rápido (Docker)

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

En producción: activa TLS (`--cert`, `--pkey`, `--tls-listening-port=5349`) y limita los rangos de peers a tu red.

---

## Configurar en TAZIA

1. Abre **Zonas**.
2. Expande **Arreglar** · *¿No llegáis a conectar?* (se abre solo tras errores de peer-connect / ICE).
3. Activa **Usar TURN como respaldo**.
4. Datos del servidor:
   - **URL:** `turn:your-server.example.com:3478`
   - **Usuario:** `tazia`
   - **Credencial:** `your-secret-password`
5. Opcional: **Solo retransmisión** (oculta tu IP; necesita que TURN funcione).
6. Crea o entra a una zona — **ambos** peers con la misma config, luego volved a entrar.

Las credenciales viven en **`sessionStorage`** por defecto (desaparecen al cerrar la pestaña). **Recordar en este dispositivo** las guarda en `localStorage`. No se envían al hosting de TAZIA.

### Comprobar solo relay

1. Activa **Solo retransmisión** con un TURN que funcione.
2. Abre `chrome://webrtc-internals/` o `about:webrtc`.
3. Los candidatos activos deberían ser tipo `relay` (sin ruta útil `host` / `srflx`).

---

## Checklist: ICE failed

Síntoma: `WebRTC: ICE failed, add a TURN server and see about:webrtc`

### Sin TURN (GitHub Pages)

Cuando falla ICE, TAZIA aún puede llevar foro / DM / presencia **cifrados** por relés Nostr. Verás un aviso de ruta por relé: el chat funciona, pero **no** es una conexión directa entre navegadores. Un TURN propio sigue siendo el camino a P2P WebRTC real.

### Misma Wi‑Fi (P2P sin TURN)

1. Misma URL de Pages y misma frase.
2. Chrome/Edge/Brave: **Permitir Red local** si lo pide. Si lo denegaste antes: ajustes del sitio → Red local → Permitir, y vuelve a entrar.
3. Router: desactiva aislamiento AP / clientes / Wi‑Fi de invitados que bloquee peer-to-peer.
4. Deja **Solo retransmisión** desmarcado.
5. En `chrome://webrtc-internals` / `about:webrtc` busca candidatos `host` o `*.local`.

### Redes distintas / CGNAT

1. En `about:webrtc` / `chrome://webrtc-internals` — ¿faltan candidatos `relay`?
2. **Zonas** → **Arreglar** → **Usar TURN como respaldo** + datos de coturn.
3. **Ambos** peers con la misma config; volved a entrar.
4. No actives **Solo retransmisión** hasta confirmar que TURN funciona.
5. Firewall de Windows: red Privada + permitir entrada UDP del navegador ayuda al P2P directo; TURN solo necesita salida hacia tu servidor.

Referencias: [Chrome LNA](https://developer.chrome.com/blog/local-network-access), [CGNAT](https://arxiv.org/html/2311.04658v2), [NAT traversal](https://arxiv.org/html/2510.27500).

---

## Seguridad

- TURN oculta tu IP a los peers; el operador TURN ve la tuya. Usa un servidor de confianza (idealmente el tuyo).
- Los mensajes van firmados con Ed25519: TURN no puede inventar firmas; sí ve tráfico WebRTC cifrado.
- TAZIA **no** incluye un TURN de terceros.
- **Apagar llama** limpia `sessionStorage` (TURN por defecto). **Recordar en este dispositivo** sobrevive al apagado hasta borrar datos del sitio o desmarcar.
- Modelo de amenaza: [`SECURITY.es.md`](SECURITY.es.md).
