# Spike: señalización SDP / QR manual

Español · [English](sdp-qr-spike.md)

Experimento aparte — **no** está en la app y **no** retrasa el resto del trabajo.

La idea: en un chat 1:1 (o muy pequeño), intercambiar a mano la señalización WebRTC (oferta/respuesta SDP) con QR o copiar-pegar, sin pasar por Trystero/Nostr, y luego usar el mismo canal de datos (`forumMsg` / `directMsg` / sync).

---

## Por qué se aplaza

| Problema | Detalle |
| --- | --- |
| Tamaño del QR | SDP + candidatos ICE suelen superar la capacidad práctica (sobre todo con URLs TURN). Trickle ICE pide muchos frames o un blob comprimido. |
| UX | Escanear en dos sentidos (oferta y luego respuesta) es frágil al aire libre; falla si un peer pasa a background a mitad del handshake. |
| Alcance | Bifurca el discovery respecto a Trystero `joinRoom`; duplica caminos de transporte a mantener. |
| Seguridad | El canal OOB debe ligarse a `roomId` + SAS; un QR de SDP crudo no se autentica solo. |

---

## Checklist (rama aislada)

1. `RTCPeerConnection` con `rtcConfig` / TURN de la app.
2. Crear oferta → comprimir (p. ej. deflate + base64url) → QR página A.
3. Peer B escanea → setRemoteDescription → crear respuesta → QR de vuelta.
4. Abrir un DataChannel; reutilizar framing `forumMsg` / `directMsg` **o** un puente fino hacia `joinP2pRoom`.
5. Medir tamaños de payload QR con/sin trickle; decidir multi-frame vs compartir archivo.
6. Documentar modos de fallo (cámara iOS, reflejos, pegado truncado).

### Fuera de alcance de este spike

- Sustituir Nostr en salas multiparty.
- Embarcarlo junto al release single-file o al sello pairwise de Susurro.
- Reclamar anonimato por el intercambio QR (cámara / capturas filtran).

---

## Relacionado

Hoy el mesh en vivo sigue siendo Trystero 0.27 (`leave` / `join`; sin API `restartIce`). Resiliencia móvil: Wake Lock + `visibilitychange` / `online` → `nudgeTransport` + fallback Nostr cifrado.

Amenaza: [`SECURITY.es.md`](SECURITY.es.md). Wire: [`PROTOCOL.es.md`](PROTOCOL.es.md).
