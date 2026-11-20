# TAZIA Turn — native helper

Zero-Docker TURN/STUN for TAZIA (**Zones → Fix**), built with [pion/turn](https://github.com/pion/turn).

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

Flags: `-port 3478` `-user tazia` `-pass …` `-external-ip …` `-public` `-no-firewall`

If port 3478 is busy (e.g. Docker coturn), use `-port 3479` or stop the other process.

## Android

```powershell
.\build\build-android.ps1
adb install -r dist\TaziaTurn-android-debug.apk
```

Or open `android/` in Android Studio → Run.

On the phone: **Iniciar** → **Copiar tarjeta** → paste into TAZIA on every peer → rejoin the zone. Keep Wi‑Fi on and the notification alive.

## Dev layout

```text
cmd/tazia-turn/     CLI entry
internal/server/    pion/turn wrapper
mobile/             gomobile-friendly API (optional)
android/            Kotlin foreground-service app
build/              desktop + android scripts
dist/               build outputs (gitignored)
```

Docs: [`docs/TURN.md`](../../docs/TURN.md) · Docker fallback: [`docker/coturn/`](../../docker/coturn/)
