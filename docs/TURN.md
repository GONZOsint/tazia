# Connection and TURN — TAZIA

English · [Español](TURN.es.md)

By default devices find each other directly (STUN-assisted P2P). On many home networks — especially behind **CGNAT** (several households share one public IP) — that is not enough: the browser shows `WebRTC: ICE failed, add a TURN server`.

**TURN** is a middlebox that relays traffic when the direct path fails. Optionally you can **force relay-only** to also hide your IP from other peers.

UI labels: **Fix** · **Use TURN as fallback** · **Force relay only**  
(Spanish: Arreglar / Usar TURN como respaldo / Solo retransmisión).

---

## When you need it

| Mode | Behind CGNAT | IP visible to peers | Latency |
| --- | --- | --- | --- |
| Default (STUN/P2P) | Often fails | Yes | Low |
| TURN as fallback | Yes | Yes (until relay used) | Low / higher if relayed |
| TURN force-relay | Yes | No (only TURN IP) | Higher |

On the **same Wi‑Fi**, TURN is often unnecessary: allow local network access and turn off the router’s client isolation. On different networks or CGNAT, your own TURN is the path to real WebRTC.

---

## Quick coturn (Docker)

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

For production: enable TLS (`--cert`, `--pkey`, `--tls-listening-port=5349`) and restrict peer ranges to your network.

---

## Configure in TAZIA

1. Open **Zones**.
2. Expand **Fix** · *Can't reach each other?* (opens after peer-connect / ICE errors).
3. Enable **Use TURN as fallback**.
4. Server details:
   - **URL:** `turn:your-server.example.com:3478`
   - **Username:** `tazia`
   - **Credential:** `your-secret-password`
5. Optional: **Force relay only** (hides your IP; needs working TURN).
6. Create or join a zone — **both** peers need the same settings, then rejoin.

Credentials live in **`sessionStorage`** by default (gone when the tab closes). **Remember on this device** stores them in `localStorage`. They are not sent to TAZIA hosting.

### Verify relay-only

1. Enable **Force relay only** with a working TURN server.
2. Open `chrome://webrtc-internals/` or `about:webrtc`.
3. Active ICE candidates should be type `relay` (no usable `host` / `srflx` path).

---

## Checklist: ICE failed

Symptom: `WebRTC: ICE failed, add a TURN server and see about:webrtc`

### Without TURN (GitHub Pages)

When ICE fails, TAZIA can still carry **encrypted** forum / DM / presence over Nostr relays. You should see a relay-path notice: chat works, but it is **not** a direct browser-to-browser mesh. Self-hosted TURN remains the path to real WebRTC P2P.

### Same Wi‑Fi (P2P without TURN)

1. Same Pages URL and same phrase.
2. Chrome/Edge/Brave: **Allow Local network** if prompted. If previously denied: site settings → Local network → Allow, then rejoin.
3. Router: disable AP / client isolation / guest Wi‑Fi that blocks peer-to-peer.
4. Leave **Force relay only** unchecked.
5. In `chrome://webrtc-internals` / `about:webrtc`, look for `host` or `*.local` candidates.

### Different networks / CGNAT

1. In `about:webrtc` / `chrome://webrtc-internals` — missing `relay` candidates?
2. **Zones** → **Fix** → **Use TURN as fallback** + coturn details.
3. **Both** peers with the same config; rejoin.
4. Do not enable **Force relay only** until TURN works.
5. Windows firewall: Private network + inbound Allow for the browser (UDP) helps direct P2P; TURN only needs outbound to your server.

References: [Chrome LNA](https://developer.chrome.com/blog/local-network-access), [CGNAT](https://arxiv.org/html/2311.04658v2), [NAT traversal](https://arxiv.org/html/2510.27500).

---

## Security notes

- TURN hides your IP from peers; the TURN operator sees yours. Use a server you trust (ideally one you run).
- Messages are Ed25519-signed: TURN cannot forge signatures; it can see encrypted WebRTC traffic.
- TAZIA does **not** ship a third-party TURN.
- **Burn session** clears `sessionStorage` (default TURN). **Remember on this device** survives burn until you clear site data or uncheck it.
- Threat model: [`SECURITY.md`](SECURITY.md).
