# TAZIA Turn — native helper (primary)

**Primary** zero-Docker TURN/STUN for TAZIA (**Zones → Fix**), built with [pion/turn](https://github.com/pion/turn). Use this before the [Docker coturn fallback](../../docker/coturn/).

| Artifact | Path after build |
| --- | --- |
| Windows | `dist/TaziaTurn.exe` (or double-click `TaziaTurn.bat`) |
| macOS | `dist/tazia-turn-darwin-arm64` / `…-amd64` (or `TaziaTurn.command`) |
| Android APK | `dist/TaziaTurn-android-debug.apk` |

Requires [Go 1.22+](https://go.dev/dl/) to rebuild. Android APK also needs Android SDK / Studio once.

## Quick start (desktop)

```powershell
# Windows
cd tools/tazia-turn
.\build\build-desktop.ps1
.\dist\TaziaTurn.exe
# or: .\TaziaTurn.bat
```

```bash
# macOS / Linux
cd tools/tazia-turn
chmod +x build/build-desktop.sh TaziaTurn.command
./build/build-desktop.sh
./dist/tazia-turn-darwin-arm64   # or linux-amd64 / darwin-amd64
```

### Flags

| Flag | Default | Meaning |
| --- | --- | --- |
| `-port` | `3478` | Listen port |
| `-auto-port` | `true` | If busy, try the next 10 ports |
| `-user` | `tazia` | TURN username |
| `-pass` | *(saved / random)* | Password; reused from user config unless `-fresh` |
| `-fresh` | off | Ignore saved password |
| `-clear-saved` | off | Delete saved credentials and exit |
| `-external-ip` | auto LAN | Advertised IP |
| `-public` | off | Detect public IP (WAN) instead of LAN |
| `-no-firewall` | off | Skip Windows firewall rule |

If Docker coturn already owns 3478, native helper moves to **3479+** automatically — copy the printed URL (port matters).

Password is stored under the OS config dir (`tazia-turn/session.json`, outside the repo) so peers can keep the same card across restarts. Rotate with `-fresh`. Do not copy that file into the git tree.

## Android

```powershell
.\build\build-android.ps1
adb install -r dist\TaziaTurn-android-debug.apk
```

Or open `android/` in Android Studio → Run.

On the phone: **Start** → **Copy card** → paste into TAZIA on every peer → rejoin the zone. Keep Wi‑Fi on and the notification alive.

- Reuses the last password until **New password & restart**
- If 3478 is busy, tries 3479–3488
- If the native process dies, the notification stops and the UI shows an error

## Dev layout

```text
cmd/tazia-turn/     CLI entry
internal/server/    pion/turn wrapper (+ port fallback)
internal/persist/   saved desktop credentials
mobile/             gomobile-friendly API (optional)
android/            Kotlin foreground-service app
build/              desktop + android scripts
dist/               build outputs (gitignored)
```

Docs: [`docs/TURN.md`](../../docs/TURN.md) · Docker fallback: [`docker/coturn/`](../../docker/coturn/)
