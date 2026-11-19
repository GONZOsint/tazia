# Self-hosted TURN for TAZIA

English · [Español](TURN.es.md)

By default, TAZIA peers connect directly (STUN-assisted P2P). Many home NATs
(especially CGNAT) **cannot** complete ICE with STUN alone — Firefox shows
`WebRTC: ICE failed, add a TURN server`.

TURN relays media when direct paths fail. Optionally you can **force relay-only**
to also hide your IP from peers.

UI labels below are English; Spanish UI uses **Arreglar** / **Usar TURN como respaldo** / **Solo retransmisión**.

## Why TURN?

| Mode | Connect behind CGNAT | Your IP visible to peers | Latency |
|------|----------------------|--------------------------|---------|
| Default (STUN/P2P) | Often fails | Yes | Low |
| TURN as fallback | Yes | Yes (until relay used) | Low / higher if relayed |
| TURN force-relay | Yes | No (only TURN IP) | Higher |

## Quick start with Docker (coturn)

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

> **Note:** For production, enable TLS (`--cert`, `--pkey`, `--tls-listening-port=5349`)
> and restrict peer ranges as appropriate for your network.

## Configure in TAZIA

1. Open the **Zones** tab.
2. Expand **Fix** · *Can't reach each other?* (auto-opens after peer-connect / ICE errors).
3. Enable **Use TURN as fallback**.
4. Enter your server details:
   - **URL:** `turn:your-server.example.com:3478`
   - **Username:** `tazia`
   - **Credential:** `your-secret-password`
5. Optional: enable **Force relay only** to hide your IP (requires working TURN).
6. Create or join a zone — **both** peers need the same TURN settings, then rejoin.

Credentials stay in this browser’s **`sessionStorage` by default** (leave with the tab). Opt-in **Remember on this device** stores them in `localStorage`. They are not sent to TAZIA hosting.

## Verify relay-only mode

1. Enable **Force relay only** with a working TURN server.
2. Open `chrome://webrtc-internals/` (Chrome/Brave) or `about:webrtc` (Firefox).
3. Confirm active ICE candidates are type `relay` (no usable `host` / `srflx` path).

## ICE failed on GitHub Pages / CGNAT — checklist

Symptom: `WebRTC: ICE failed, add a TURN server and see about:webrtc`

### Without TURN on GitHub Pages

When WebRTC ICE fails after SDP exchange, TAZIA can still carry **encrypted**
forum / DM / presence over Nostr discovery relays (AES-GCM with the zone phrase).
You should see a notice that the relay path is active — chat works, but it is
**not** a direct mesh. Self-hosted TURN remains the path for real WebRTC P2P.

### Same Wi‑Fi (true P2P without TURN)

1. Both peers open the **same** Pages URL and join with the **same** phrase.
2. Chrome/Edge/Brave: if prompted, **Allow Local network** (public origin → LAN). If previously denied: site settings → Local network → Allow, then rejoin.
3. Router: disable **AP / client isolation** / guest Wi‑Fi that blocks peer-to-peer.
4. Leave **Force relay only** unchecked (relay-only drops host candidates).
5. Check `chrome://webrtc-internals` / `about:webrtc` for `host` or `*.local` candidates.

### Different networks / CGNAT

1. Open `about:webrtc` or `chrome://webrtc-internals` — look for missing `relay` candidates.
2. In TAZIA → **Zones** → expand **Fix**.
3. Enable **Use TURN as fallback**, enter your coturn URL / user / password.
4. **Both** peers must use the same TURN settings, then rejoin.
5. Do **not** enable **Force relay only** until TURN is confirmed working.
6. Windows firewall: Private network + inbound Allow for the browser (UDP) helps direct P2P; TURN only needs outbound to your server.

References: [Chrome LNA](https://developer.chrome.com/blog/local-network-access), [arXiv:2311.04658](https://arxiv.org/html/2311.04658v2) (CGNAT), [arXiv:2510.27500](https://arxiv.org/html/2510.27500) (NAT traversal baselines).

## Security notes

- TURN hides your IP from peers, but the TURN operator sees your IP. Use a server you trust (ideally one you run).
- App messages are Ed25519-signed. TURN cannot forge signatures; it can see encrypted WebRTC traffic.
- TAZIA does **not** ship a third-party TURN; self-host or use a TURN you control.
- **Burn session** clears `sessionStorage` (default TURN). Opted-in **Remember on this device** (`localStorage`) survives burn until you clear site data or uncheck remember.
- See also [`SECURITY.md`](SECURITY.md) (threat model) and the encrypted Nostr data-plane fallback when ICE fails.
