# Connection and TURN — TAZIA

English · [Español](TURN.es.md)

By default devices find each other directly (STUN-assisted P2P). On many home networks — especially behind **CGNAT** (several households share one public IP) — that is not enough: the browser shows `WebRTC: ICE failed, add a TURN server`.

**TURN** is a middlebox that relays traffic when the direct path fails. Enabling a helper server also turns on **Hide my internet address** (relay-only) by default so peers do not see your IP.

UI labels: **Fix** · **Use a helper server** · **Hide my internet address**  
(Spanish: Arreglar / Usar servidor de apoyo / Ocultar mi dirección de internet).

---

## When you need it

| Mode | Behind CGNAT | IP visible to peers | Latency |
| --- | --- | --- | --- |
| Helper off (STUN/P2P) | Often fails | Yes | Low |
| Helper on + hide address (default) | Yes | No (only helper IP) | Higher |
| Helper on + hide address off | Yes | Yes until a relay path is used | Low / higher if relayed |

On the **same Wi‑Fi**, a helper is often unnecessary: allow local network access, turn off the router’s client isolation, and **uncheck** “Hide my internet address” if you enabled a helper for other peers. On different networks or CGNAT, your own TURN is the path to real WebRTC.

---

## Native (recommended: no Docker)

Go binaries ([`tools/tazia-turn/`](../tools/tazia-turn/)) — pion/turn, zero Docker:

| OS | Action |
| --- | --- |
| **Windows** | Double-click [`tools/tazia-turn/TaziaTurn.bat`](../tools/tazia-turn/TaziaTurn.bat) → `dist/TaziaTurn.exe` |
| **macOS** | Double-click [`TaziaTurn.command`](../tools/tazia-turn/TaziaTurn.command) or `./dist/tazia-turn-darwin-arm64` |
| **Android** | Install [`TaziaTurn-android-debug.apk`](../tools/tazia-turn/README.md) (sideload) → **Start** → copy card |

Build: `tools/tazia-turn/build/build-desktop.ps1` · `build-android.ps1`. Details: [`tools/tazia-turn/README.md`](../tools/tazia-turn/README.md).

## Coturn (Docker, optional)

Zero-friction on LAN with Docker — detects IP, writes `.env`, starts coturn, smoke-tests, prints the card for **Zones → Fix**:

| OS | Action |
| --- | --- |
| **Windows** | Double-click [`docker/coturn/install/windows/TaziaTurn.bat`](../docker/coturn/install/windows/TaziaTurn.bat) |
| **macOS / Linux** | `chmod +x docker/coturn/install/macos/install-tazia-turn.sh && ./docker/coturn/install/macos/install-tazia-turn.sh` |
| **Android** | Prefer the native APK above; otherwise host on a PC. [`install/android/README.md`](../docker/coturn/install/android/README.md) |

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine). Details: [`docker/coturn/install/README.md`](../docker/coturn/install/README.md).

### Manual (Docker Compose)

`--network host` works on Linux servers; **Docker Desktop (Windows/macOS) needs published ports + `external-ip`**. Use the compose stack in [`docker/coturn/`](../docker/coturn/):

```bash
cd docker/coturn
cp .env.example .env
# Edit .env: TURN_PASS + EXTERNAL_IP
#   LAN IP for same-Wi‑Fi testing; public IP (or hostname) when peers are elsewhere / CGNAT
docker compose up -d
docker compose logs -f coturn
```

Then in TAZIA: `turn:<EXTERNAL_IP>:3478` · user/pass from `.env` · both peers same config · **rejoin** (ICE/TURN apply at join, not hot-reload after Fix edits). See also [`docker/coturn/README.md`](../docker/coturn/README.md).

Smoke (inside the container; replace `YOUR_PASS` with `TURN_PASS` from `.env`):

```bash
docker compose exec coturn turnutils_stunclient 127.0.0.1
docker compose exec coturn turnutils_uclient -v -t -u tazia -w YOUR_PASS -e 1.1.1.1 127.0.0.1
```

Expect `Received relay addr: <EXTERNAL_IP>:491xx` and channel-bind success. Do not use `-e 127.0.0.1` (403 on loopback peer is normal).

Relay UDP ports **49160–49200** must be reachable (compose maps them). Narrow range on purpose for Desktop; widen on a VPS with host networking if you need more concurrent relays.

### Linux VPS (host network, optional)

Prefer the compose stack above (it injects `external-ip` via entrypoint). Stock `coturn/coturn` ignores `DETECT_EXTERNAL_IP` — pass `--external-ip=` yourself:

```bash
docker run -d --name tazia-coturn --network host --restart unless-stopped \
  coturn/coturn:4.6.3 \
  -n --realm=tazia.local --fingerprint --lt-cred-mech \
  --user=tazia:YOUR_PASS \
  --external-ip=YOUR_PUBLIC_IP \
  --listening-port=3478 --min-port=49160 --max-port=49200 \
  --no-tls --no-dtls --no-cli
```

For production: TLS (`turns:` / 5349), rotate credentials, firewall the relay range.

---

## Configure in TAZIA

1. Open **Zones**.
2. Expand **Fix** · *Can't reach each other?* (opens after peer-connect / ICE errors).
3. Enable **Use a helper server** — **Hide my internet address** (relay-only) turns **on by default** for peer-IP obfuscation. Uncheck it if you need same-LAN host candidates.
4. Server details:
   - **URL:** `turn:your-server.example.com:3478`
   - **Username:** `tazia`
   - **Credential:** `your-secret-password`
5. The helper **operator still sees your IP** — relay-only is not Tor / strong anonymity.
6. Create or join a zone — **both** peers need the same settings, then **rejoin** (changing Fix after you are already in a zone does not reload ICE until you leave and join again).

Credentials live in **`sessionStorage`** by default (gone when the tab closes). **Remember on this device** stores them in `localStorage`. They are not sent to TAZIA hosting.

### Nostr relays (signaling / fallback)

In the same **Fix** panel you can enable **Use custom Nostr relays** and paste `wss://` URLs (one per line). Trystero then skips its default public relay pool; signaling and encrypted fallback use your list. Those relay operators **still see your IP** (and encrypted traffic metadata) — not Tor. Same storage rule: session by default, optional “Remember on this device” (`tazia:nostr-relays` / `tazia:nostr-relays-persist`). After changing the list, **rejoin** the zone.

### Verify relay-only

1. Leave **Hide my internet address** checked (default when the helper is on) with a working TURN server.
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
4. If a helper is enabled for other networks, **uncheck** **Hide my internet address** so same-LAN host candidates can form.
5. In `chrome://webrtc-internals` / `about:webrtc`, look for `host` or `*.local` candidates.

### Different networks / CGNAT

1. Smoke-test coturn first (`turnutils_uclient` … `-e 1.1.1.1` above) until you see a relay addr on `EXTERNAL_IP`.
2. **Zones** → **Fix** → **Use a helper server** + coturn details (relay-only / hide address is on by default — intentional).
3. **Both** peers with the same config; rejoin.
4. If debugging ICE, temporarily **uncheck** **Hide my internet address**; turn it back on once relay works.
5. Windows firewall: Private network + inbound Allow for the browser (UDP) helps direct P2P; TURN only needs outbound to your server.

References: [Chrome LNA](https://developer.chrome.com/blog/local-network-access), [CGNAT](https://arxiv.org/html/2311.04658v2), [NAT traversal](https://arxiv.org/html/2510.27500).

---

## Security notes

- **Hide my internet address** (force relay) hides your IP from **peers**; the TURN operator still sees yours. Use a server you trust (ideally one you run). This is not Tor / strong anonymity.
- Peers / STUN / TURN / Nostr each see different surfaces — table in [`SECURITY.md`](SECURITY.md) (“IP visibility”).
- Messages are Ed25519-signed: TURN cannot forge signatures; it can see encrypted WebRTC traffic.
- TAZIA does **not** ship a third-party TURN.
- **Extinguish flame** clears `sessionStorage` (default TURN). **Remember on this device** and IP consent survive unless you check the forget-device-prefs box on the confirm dialog (or clear site data / Help → Forget this device).
- Brave *WebRTC IP Handling* is a browser knob, not an in-app control.
- Threat model: [`SECURITY.md`](SECURITY.md).
