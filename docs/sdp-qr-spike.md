# Spike: manual SDP / QR signaling (P3)

English · [Español](sdp-qr-spike.es.md)

**Status:** spike only — does **not** block shipping work. Not wired into the app.

## Goal

Bypass Trystero/Nostr signaling for a 1:1 (or tiny) mesh by exchanging SDP offers/answers out-of-band (QR / copy-paste), then upgrading to the same DataChannel protocol (`forumMsg` / `directMsg` / sync framing).

## Why deferred

| Issue | Detail |
| --- | --- |
| QR size | Full SDP + ICE candidates often exceed practical QR capacity (esp. with TURN URLs). Trickle ICE needs many frames or a compressed blob. |
| UX | Scanning two ways (offer then answer) is fragile outdoors; fails closed if either peer backgrounds mid-handshake. |
| Scope | Forks discovery away from Trystero `joinRoom`; doubles transport paths to maintain. |
| Security | OOB channel must bind to `roomId` + SAS; raw SDP QR is not authenticated by itself. |

## Spike checklist (isolated branch)

1. `RTCPeerConnection` with app `rtcConfig` / TURN settings.
2. Create offer → compress (e.g. deflate + base64url) → QR page A.
3. Peer B scans → setRemoteDescription → create answer → QR back.
4. Open one DataChannel; reuse `forumMsg` / `directMsg` framing **or** a thin bridge into `joinP2pRoom` internals.
5. Measure QR payload sizes with/without trickle; decide multi-frame vs file share.
6. Document failure modes (iOS camera, glare, truncated paste).

## Non-goals for this spike

- Replacing Nostr for multi-peer rooms.
- Shipping in the same PR as single-file release or Susurro pairwise seal.
- Claiming anonymity from QR exchange (camera / screenshots leak).

## Related

- Live mesh remains Trystero 0.27 (`leave` / `join`; no `restartIce` API).
- Mobile resilience today: Wake Lock + `visibilitychange` / `online` → `nudgeTransport` + encrypted Nostr data-plane fallback.
- Threat model: [`SECURITY.md`](SECURITY.md). Wire format: [`PROTOCOL.md`](PROTOCOL.md).
