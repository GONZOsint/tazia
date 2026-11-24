# Conexión y TURN — TAZIA

Español · [English](TURN.md)

Por defecto los dispositivos se encuentran en directo (P2P con ayuda de STUN). En muchos hogares —sobre todo detrás de **CGNAT** (varios vecinos comparten la misma IP pública)— eso no basta: el navegador muestra `WebRTC: ICE failed, add a TURN server`.

**TURN** es un servidor intermedio que retransmite el tráfico cuando falla la ruta directa. Al activar un servidor de apoyo también se enciende **Ocultar mi dirección de internet** (solo relay) por defecto para que los peers no vean tu IP.

En la UI: **Arreglar** · **Usar servidor de apoyo** · **Ocultar mi dirección de internet**  
(en inglés: Fix / Use a helper server / Hide my internet address).

---

## Cuándo hace falta

| Modo | Detrás de CGNAT | IP visible a peers | Latencia |
| --- | --- | --- | --- |
| Servidor de apoyo off (STUN/P2P) | Suele fallar | Sí | Baja |
| Apoyo on + ocultar dirección (por defecto) | Sí | No (solo IP del apoyo) | Mayor |
| Apoyo on + ocultar dirección off | Sí | Sí hasta usar relay | Baja / mayor si relay |

Si estáis en la **misma Wi‑Fi**, a menudo no hace falta apoyo: basta permitir red local, desactivar el aislamiento de clientes del router y **desmarcar** «Ocultar mi dirección de internet» si activasteis un apoyo por otros peers. Si estáis en redes distintas o CGNAT, un TURN propio es el camino a WebRTC real.

---

## Nativo (recomendado: sin Docker)

Binarios Go ([`tools/tazia-turn/`](../tools/tazia-turn/)) — pion/turn, cero Docker:

| OS | Acción |
| --- | --- |
| **Windows** | Doble clic [`tools/tazia-turn/TaziaTurn.bat`](../tools/tazia-turn/TaziaTurn.bat) → `dist/TaziaTurn.exe` |
| **macOS** | Doble clic [`TaziaTurn.command`](../tools/tazia-turn/TaziaTurn.command) o `./dist/tazia-turn-darwin-arm64` |
| **Android** | Instala [`TaziaTurn-android-debug.apk`](../tools/tazia-turn/README.md) (sideload) → **Iniciar** → copiar tarjeta |

Build: `tools/tazia-turn/build/build-desktop.ps1` · `build-android.ps1`. Detalle: [`tools/tazia-turn/README.md`](../tools/tazia-turn/README.md).

El helper nativo **reutiliza la última contraseña**, cambia de puerto si el **3478** está ocupado (3479+), y copia la tarjeta `turn:ip:puerto` exacta. En Android vigila el proceso y muestra error si muere. No levantes también coturn Docker en el mismo puerto de esa máquina.

## Coturn (Docker, opcional)

Cero fricción en LAN con Docker — detecta IP, escribe `.env`, arranca coturn, smoke y tarjeta para **Zonas → Arreglar**:

| OS | Acción |
| --- | --- |
| **Windows** | Doble clic en [`docker/coturn/install/windows/TaziaTurn.bat`](../docker/coturn/install/windows/TaziaTurn.bat) |
| **macOS / Linux** | `chmod +x docker/coturn/install/macos/install-tazia-turn.sh && ./docker/coturn/install/macos/install-tazia-turn.sh` |
| **Android** | Preferir la APK nativa arriba; si no, host en PC. [`install/android/README.md`](../docker/coturn/install/android/README.md) |

Requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (o Docker Engine). Detalle: [`docker/coturn/install/README.md`](../docker/coturn/install/README.md).

### Manual (Docker Compose)

`--network host` vale en servidores Linux; **Docker Desktop (Windows/macOS) necesita puertos publicados + `external-ip`**. Usa el stack en [`docker/coturn/`](../docker/coturn/):

```bash
cd docker/coturn
cp .env.example .env
# Edita .env: TURN_PASS + EXTERNAL_IP
#   IP LAN para misma Wi‑Fi; IP pública (o hostname) si los peers están fuera / CGNAT
docker compose up -d
docker compose logs -f coturn
```

En TAZIA: `turn:<EXTERNAL_IP>:3478` · user/pass del `.env` · ambos peers igual · **volver a entrar** (ICE/TURN se aplican al unirse, no al editar Arreglar en caliente). Ver también [`docker/coturn/README.md`](../docker/coturn/README.md).

Smoke (dentro del contenedor; sustituye `TU_PASS` por `TURN_PASS` del `.env`):

```bash
docker compose exec coturn turnutils_stunclient 127.0.0.1
docker compose exec coturn turnutils_uclient -v -t -u tazia -w TU_PASS -e 1.1.1.1 127.0.0.1
```

Esperado: `Received relay addr: <EXTERNAL_IP>:491xx` y channel-bind OK. No uses `-e 127.0.0.1` (403 a loopback es normal).

Los UDP de relay **49160–49200** tienen que ser alcanzables (compose los mapea). Rango estrecho a propósito para Desktop; en un VPS con host networking puedes ampliarlo.

### VPS Linux (host network, opcional)

Prefiere el compose de arriba (inyecta `external-ip` en el entrypoint). La imagen stock `coturn/coturn` ignora `DETECT_EXTERNAL_IP` — pasa `--external-ip=` tú mismo:

```bash
docker run -d --name tazia-coturn --network host --restart unless-stopped \
  coturn/coturn:4.6.3 \
  -n --realm=tazia.local --fingerprint --lt-cred-mech \
  --user=tazia:TU_PASS \
  --external-ip=TU_IP_PUBLICA \
  --listening-port=3478 --min-port=49160 --max-port=49200 \
  --no-tls --no-dtls --no-cli
```

En producción: TLS (`turns:` / 5349), rotar credenciales, firewall al rango relay.

---

## Configurar en TAZIA

1. Abre **Zonas**.
2. Expande **Arreglar** · *¿No llegáis a conectar?* (se abre solo tras errores de peer-connect / ICE).
3. Activa **Usar servidor de apoyo** — **Ocultar mi dirección de internet** (solo relay) se enciende **por defecto** para ofuscar la IP frente a peers. Desmárcalo si necesitas candidatos host en la misma LAN.
4. Datos del servidor:
   - **URL:** `turn:your-server.example.com:3478`
   - **Usuario:** `tazia`
   - **Credencial:** `your-secret-password`
5. El **operador** del servidor **sigue viendo tu IP** — solo-relay no es Tor / anonimato fuerte.
6. Crea o entra a una zona — **ambos** peers con la misma config, luego **volved a entrar** (cambiar Arreglar ya dentro de una zona no recarga ICE hasta salir y volver a unirse).

Las credenciales viven en **`sessionStorage`** por defecto (desaparecen al cerrar la pestaña). **Recordar en este dispositivo** las guarda en `localStorage`. No se envían al hosting de TAZIA.

### Relés Nostr (señalización / fallback)

En el mismo panel **Arreglar** puedes activar **Usar relés Nostr propios** y pegar URLs `wss://` (una por línea). Así Trystero deja de elegir relés públicos por defecto; señalización y fallback cifrado usan tu lista. Los operadores de esos relés **siguen viendo tu IP** (y metadatos del tráfico cifrado) — no es Tor. Misma regla de almacenamiento: sesión por defecto, opcional «Recordar en este dispositivo» (`tazia:nostr-relays` / `tazia:nostr-relays-persist`). Tras cambiar la lista, **volved a entrar** en la zona.

### Comprobar solo relay

1. Deja **Ocultar mi dirección de internet** marcado (por defecto al activar el apoyo) con un TURN que funcione.
2. Abre `chrome://webrtc-internals/` o `about:webrtc`.
3. Los candidatos activos deberían ser tipo `relay` (sin ruta útil `host` / `srflx`).

---

## Checklist: ICE failed

Síntoma: `WebRTC: ICE failed, add a TURN server and see about:webrtc`

### Sin TURN (GitHub Pages)

GitHub Pages es solo HTTPS estático: **no** puede servir TURN ni cabeceras HTTP de seguridad custom. Cuando falla ICE, TAZIA aún puede llevar foro / DM / presencia **cifrados** por relés Nostr. Verás un aviso de ruta por relé: el chat funciona, pero **no** es una conexión directa entre navegadores. Usa [`tools/tazia-turn`](../tools/tazia-turn/) o coturn para P2P WebRTC real. Opcional: Zonas → Arreglar → relés Nostr `wss://` propios (misma lista en todos los peers).

### Misma Wi‑Fi (P2P sin TURN)

1. Misma URL de Pages y misma frase.
2. Chrome/Edge/Brave: **Permitir Red local** si lo pide (origen público → LAN). Si lo denegaste antes: ajustes del sitio → Red local → Permitir, y vuelve a entrar.
3. Router: desactiva aislamiento AP / clientes / Wi‑Fi de invitados que bloquee peer-to-peer.
4. Si hay un apoyo activado por otras redes, **desmarca** **Ocultar mi dirección de internet** para que puedan formarse candidatos host en la misma LAN.
5. En `chrome://webrtc-internals` / `about:webrtc` busca candidatos `host` o `*.local`.

### Redes distintas / CGNAT

1. Haz smoke de coturn primero (`turnutils_uclient` … `-e 1.1.1.1` arriba) hasta ver relay en `EXTERNAL_IP`.
2. **Zonas** → **Arreglar** → **Usar servidor de apoyo** + datos de coturn (ocultar dirección / solo relay va **on** por defecto — a propósito).
3. **Ambos** peers con la misma config; volved a entrar.
4. Si depuras ICE, **desmarca** temporalmente **Ocultar mi dirección de internet**; vuelve a marcarlo cuando el relay funcione.
5. Firewall de Windows: red Privada + permitir entrada UDP del navegador ayuda al P2P directo; TURN solo necesita salida hacia tu servidor.

Referencias: [Chrome LNA](https://developer.chrome.com/blog/local-network-access), [CGNAT](https://arxiv.org/html/2311.04658v2), [NAT traversal](https://arxiv.org/html/2510.27500).

---

## Seguridad

- **Ocultar mi dirección de internet** (solo relay) oculta tu IP a los **peers**; el operador TURN sigue viendo la tuya. Usa un servidor de confianza (idealmente el tuyo). No es Tor / anonimato fuerte.
- Peers / STUN / TURN / Nostr ven superficies distintas — tabla en [`SECURITY.es.md`](SECURITY.es.md) («Visibilidad de IP»).
- Los mensajes van firmados con Ed25519: TURN no puede inventar firmas; sí ve tráfico WebRTC cifrado.
- TAZIA **no** incluye un TURN de terceros.
- **Apagar llama** limpia `sessionStorage` (TURN por defecto). **Recordar en este dispositivo** y el consentimiento de IP sobreviven salvo el checkbox de olvidar prefs en el diálogo (o borrar datos / Ayuda → Olvidar este dispositivo).
- Brave *WebRTC IP Handling* es un ajuste del navegador, no un control de la app.
- Modelo de amenaza: [`SECURITY.es.md`](SECURITY.es.md).
