# Self-Hosted TURN Relay for TAZIA

By default, TAZIA peers connect directly (STUN-assisted P2P). If you want to
**hide your IP address** from other peers, you can route all WebRTC traffic
through a TURN relay that you control.

## Why TURN?

| Mode | Your IP visible to peers | Latency | Cost |
|------|--------------------------|---------|------|
| Default (STUN/P2P) | Yes | Low | Free |
| TURN relay | No (only TURN server IP visible) | Higher | Self-hosted |

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
2. Expand the **TURN Relay** panel at the bottom.
3. Check **Force relay mode**.
4. Enter your server details:
   - **URL:** `turn:your-server.example.com:3478`
   - **Username:** `tazia`
   - **Credential:** `your-secret-password`
5. Create or join a room — all traffic will now route through your TURN server.

## Verify relay-only mode

In your browser DevTools Console:

```js
// Check active ICE candidates
const pc = document.querySelector('video')?.srcObject; // or use webrtc-internals
```

Or visit `chrome://webrtc-internals/` and confirm all candidates are type `relay`.

## Security Notes

- TURN relay hides your IP from peers but the TURN server operator can see
  your IP. Only use a server you trust (ideally one you run yourself).
- TAZIA messages are end-to-end signed (Ed25519). The TURN server cannot
  forge or modify messages, but it can see encrypted WebRTC traffic.
- The TURN credentials are stored in your browser's localStorage and never
  sent to TAZIA or any third party.
