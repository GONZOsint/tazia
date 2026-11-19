# Spike: manual SDP / QR signaling

English · [Español](sdp-qr-spike.es.md)

Side experiment — **not** in the app and **not** blocking other work.

The idea: for a 1:1 (or tiny) chat, exchange WebRTC signaling by hand (SDP offer/answer via QR or copy-paste) without Trystero/Nostr, then use the same data-channel protocol (`forumMsg` / `directMsg` / sync).

---

## Why deferred

| Issue | Detail |
| --- | --- |
| QR size | Full SDP + ICE candidates often exceed practical QR capacity (especially with TURN URLs). Trickle ICE needs many frames or a compressed blob. |
| UX | Scanning two ways (offer then answer) is fragile outdoors; fails if either peer backgrounds mid-handshake. |
| Scope | Forks discovery away from Trystero `joinRoom`; doubles transport paths to maintain. |
| Security | The OOB channel must bind to `roomId` + SAS; a raw SDP QR is not authenticated by itself. |

---

## Checklist (isolated branch)

1. `RTCPeerConnection` with app `rtcConfig` / TURN settings.
2. Create offer → compress (e.g. deflate + base64url) → QR page A.
3. Peer B scans → setRemoteDescription → create answer → QR back.
4. Open one DataChannel; reuse `forumMsg` / `directMsg` framing **or** a thin bridge into `joinP2pRoom`.
5. Measure QR payload sizes with/without trickle; decide multi-frame vs file share.
6. Document failure modes (iOS camera, glare, truncated paste).

### Out of scope for this spike

- Replacing Nostr for multi-peer rooms.
- Shipping in the same PR as single-file release or Whisper pairwise seal.
- Claiming anonymity from QR exchange (camera / screenshots leak).

---

## Related

Live mesh remains Trystero 0.27 (`leave` / `join`; no `restartIce` API). Mobile resilience today: Wake Lock + `visibilitychange` / `online` → `nudgeTransport` + encrypted Nostr fallback.

Threat model: [`SECURITY.md`](SECURITY.md). Wire format: [`PROTOCOL.md`](PROTOCOL.md).
