# TAZIA helper TURN — installers

Zero-friction local TURN for end users (coturn via Docker).

| Platform | How |
| --- | --- |
| **Windows** | Double-click [`windows/TaziaTurn.bat`](windows/TaziaTurn.bat) |
| **macOS / Linux** | `chmod +x macos/install-tazia-turn.sh && ./macos/install-tazia-turn.sh` |
| **Android** | Host on a PC/Mac on the same Wi‑Fi; phone = client. See [`android/README.md`](android/README.md) |

## What the installer does

1. Detects your LAN IP (or `--public` / `-Public` for WAN)
2. Writes `docker/coturn/.env` with a random password (keeps an existing one)
3. Starts Docker Desktop if needed
4. Opens firewall ports when possible (Windows / Linux UFW)
5. Starts coturn and smoke-tests STUN + TURN allocate
6. Prints (and copies) the three lines for **TAZIA → Zones → Fix**

## Prerequisites (one-time)

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS) or Docker Engine (Linux)

## Useful flags

```text
Windows:  Install-TaziaTurn.ps1 [-Stop] [-TestOnly] [-Public] [-Pass secret]
macOS:    install-tazia-turn.sh [--stop] [--test] [--public] [--pass secret]
```

Manual / VPS notes: [`../README.md`](../README.md) · docs [`docs/TURN.md`](../../docs/TURN.md)
