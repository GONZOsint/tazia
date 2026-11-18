# Self-Hosted TURN Relay for TAZIA

By default, TAZIA peers connect directly (STUN-assisted P2P). Many home NATs
(especially CGNAT / Movistar) **cannot** complete ICE with STUN alone — Firefox
shows `WebRTC: ICE failed, add a TURN server`.

TURN fixes that by relaying media when direct paths fail. Optionally you can
**force relay-only** to also hide your IP from peers.

## Why TURN?

| Mode | Connect behind CGNAT | Your IP visible to peers | Latency |
|------|----------------------|--------------------------|---------|
| Default (STUN/P2P) | Often fails | Yes | Low |
| TURN as fallback | Yes | Yes (until relay used) | Low / higher if relayed |
| TURN force-relay | Yes | No (only TURN IP) | Higher |

## Quick Start with Docker (coturn)

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
> and restrict `--allowed-peer-ip` ranges.

## Configure in TAZIA

1. Open the **Rooms** tab.
2. Expand **TURN (connection help)**.
3. Check **Use TURN as fallback** (fixes ICE failed).
4. Enter your server details:
   - **URL:** `turn:your-server.example.com:3478`
   - **Username:** `tazia`
   - **Credential:** `your-secret-password`
5. Optional: check **Force relay only** to hide your IP (requires working TURN).
6. Create or join a room — both peers should use the same TURN settings.

## Verify relay-only mode

In your browser DevTools Console:

```js
// Check active ICE candidates
const pc = document.querySelector('video')?.srcObject; // or use webrtc-internals
```

Or visit `chrome://webrtc-internals/` and confirm all candidates are type `relay`.

## ICE failed on GitHub Pages / CGNAT — checklist

Symptom: `WebRTC: ICE failed, add a TURN server and see about:webrtc`

1. Confirm both peers are **not** on the same LAN (same Wi‑Fi often works without TURN).
2. Open `about:webrtc` (Firefox) or `chrome://webrtc-internals` — look for missing `relay` candidates.
3. In TAZIA → **Rooms** → expand **TURN (connection help)** (auto-opens after peer-connect errors).
4. Enable **Use TURN as fallback**, enter your coturn URL/user/password.
5. **Both** peers must use the same TURN settings, then rejoin.
6. Do **not** enable **Force relay only** until TURN is confirmed working.
7. Windows firewall: Private network + inbound Allow for `firefox.exe` (UDP) is enough for direct P2P; TURN only needs outbound to your server.

References: [arXiv:2311.04658](https://arxiv.org/html/2311.04658v2) (CGNAT), [arXiv:2510.27500](https://arxiv.org/html/2510.27500) (NAT traversal baselines).

## Security Notes

- TURN relay hides your IP from peers but the TURN server operator can see
  your IP. Only use a server you trust (ideally one you run yourself).
- TAZIA messages are end-to-end signed (Ed25519). The TURN server cannot
  forge or modify messages, but it can see encrypted WebRTC traffic.
- The TURN credentials are stored in your browser's localStorage and never
  sent to TAZIA or any third party.
- TAZIA does **not** ship a third-party TURN; self-host or use a TURN you control.
