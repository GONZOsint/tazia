# TAZIA coturn (Docker)

**Fallback** TURN for Zones → Fix when you prefer containers over the native helper. Prefer **[`tools/tazia-turn`](../../tools/tazia-turn/)** (desktop/Android binaries) for day-to-day use. This image works on **Docker Desktop** (Windows/macOS) without `--network host`.

Do not run Docker coturn and the native helper on the **same** host port at once. Native `-auto-port` will move to 3479+ if 3478 is taken; keep the URL port in sync with what peers paste into TAZIA.

**Secrets:** `docker/coturn/.env` holds `TURN_PASS` — it is gitignored. Never commit it, never paste it into issues/PRs. Only `.env.example` (placeholder) belongs in git.

## Zero-friction (Docker path)

| OS | Action |
| --- | --- |
| Windows | Double-click [`install/windows/TaziaTurn.bat`](install/windows/TaziaTurn.bat) |
| macOS / Linux | `chmod +x install/macos/install-tazia-turn.sh && ./install/macos/install-tazia-turn.sh` |
| Android | Host on a PC/Mac on the same Wi‑Fi — see [`install/android/README.md`](install/android/README.md) |

The installer detects LAN IP, writes `.env`, opens firewall when possible, starts coturn, smoke-tests, and prints the TAZIA card (clipboard).

More: [`install/README.md`](install/README.md)

## Manual start

```bash
cd docker/coturn
cp .env.example .env
# Set TURN_PASS and EXTERNAL_IP (LAN IP of this machine)
docker compose up -d
docker compose ps   # expect healthy
```

TAZIA fields:

| Field | Value |
| --- | --- |
| URL | `turn:<EXTERNAL_IP>:3478` |
| Username | `tazia` (or `TURN_USER`) |
| Credential | `TURN_PASS` from `.env` |

Both peers need the same config, then rejoin. Relay-only is on by default when TURN is enabled in the app.

## Smoke

```bash
# Windows
.\smoke-test.ps1

# macOS / Linux
./smoke-test.sh

# or inside the container
docker compose exec coturn turnutils_stunclient 127.0.0.1
docker compose exec coturn turnutils_uclient -v -t -u tazia -w "$TURN_PASS" -e 1.1.1.1 127.0.0.1
```

Success looks like `Received relay addr: <EXTERNAL_IP>:491xx` and `channel bind … success`. Binding to `127.0.0.1` as the peer (`-e 127.0.0.1`) returns 403 — that is expected, not a deploy failure.

## Stop

```bash
# installer
./install/macos/install-tazia-turn.sh --stop
# or
docker compose down
```

Docs: [`docs/TURN.md`](../../docs/TURN.md) · [`docs/TURN.es.md`](../../docs/TURN.es.md)
