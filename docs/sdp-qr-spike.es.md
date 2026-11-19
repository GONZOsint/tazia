# Spike: señalización SDP / QR manual (P3)

Español · [English](sdp-qr-spike.md)

**Estado:** solo spike — **no** bloquea trabajo de shipping. No está cableado en la app.

## Objetivo

Saltar la señalización Trystero/Nostr en un mesh 1:1 (o muy pequeño) intercambiando ofertas/respuestas SDP fuera de banda (QR / copiar-pegar), y luego subir al mismo protocolo de DataChannel (`forumMsg` / `directMsg` / framing de sync).

## Por qué se aplaza

| Problema | Detalle |
| --- | --- |
| Tamaño del QR | SDP completo + candidatos ICE suelen superar la capacidad práctica del QR (sobre todo con URLs TURN). Trickle ICE necesita muchos frames o un blob comprimido. |
| UX | Escanear en dos sentidos (oferta y luego respuesta) es frágil al aire libre; falla cerrado si un peer pasa a background a mitad del handshake. |
| Alcance | Bifurca el discovery respecto a Trystero `joinRoom`; duplica caminos de transporte a mantener. |
| Seguridad | El canal OOB debe ligarse a `roomId` + SAS; un QR de SDP crudo no se autentica solo. |

## Checklist del spike (rama aislada)

1. `RTCPeerConnection` con `rtcConfig` / ajustes TURN de la app.
2. Crear oferta → comprimir (p. ej. deflate + base64url) → QR página A.
3. Peer B escanea → setRemoteDescription → crear respuesta → QR de vuelta.
4. Abrir un DataChannel; reutilizar framing `forumMsg` / `directMsg` **o** un puente fino hacia internos de `joinP2pRoom`.
5. Medir tamaños de payload QR con/sin trickle; decidir multi-frame vs compartir archivo.
6. Documentar modos de fallo (cámara iOS, reflejos, pegado truncado).

## No-goals de este spike

- Sustituir Nostr en salas multiparty.
- Embarcarlo en el mismo PR que el release single-file o el sello pairwise de Susurro.
- Reclamar anonimato por el intercambio QR (cámara / capturas de pantalla filtran).

## Relacionado

- El mesh en vivo sigue siendo Trystero 0.27 (`leave` / `join`; sin API `restartIce`).
- Resiliencia móvil hoy: Wake Lock + `visibilitychange` / `online` → `nudgeTransport` + fallback de datos cifrado por Nostr.
- Modelo de amenaza: [`SECURITY.es.md`](SECURITY.es.md). Formato wire: [`PROTOCOL.es.md`](PROTOCOL.es.md).
