# TAZIA TURN on Android

## Recommended: native app

Build/install the APK from [`tools/tazia-turn/`](../../../tools/tazia-turn/):

```text
tools/tazia-turn/dist/TaziaTurn-android-debug.apk
```

1. Sideload (`adb install -r …` or open the APK on the phone)
2. Open **TAZIA Turn** → **Iniciar**
3. **Copiar tarjeta** → paste into TAZIA → Zonas → Arreglar on every peer
4. Keep the phone awake on Wi‑Fi (foreground notification)

See [`tools/tazia-turn/README.md`](../../../tools/tazia-turn/README.md).

## Alternative: host on PC/Mac

Run [`../windows/TaziaTurn.bat`](../windows/TaziaTurn.bat) or [`../macos/install-tazia-turn.sh`](../macos/install-tazia-turn.sh) (Docker coturn), then paste `turn:<PC-LAN-IP>:3478` on the phone.

## Experimental Termux

[`termux-tazia-turn.sh`](termux-tazia-turn.sh) — not zero-friction; prefer the APK.
