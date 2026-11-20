#!/data/data/com.termux/files/usr/bin/bash
# Experimental — not recommended for end users.
# Prefer hosting TURN on a PC/Mac on the same Wi‑Fi (install/windows or install/macos).
set -euo pipefail

echo "TAZIA Android TURN host — experimental"
echo "======================================"
echo
echo "Zero-friction path: run TaziaTurn on a PC/Mac on this Wi‑Fi,"
echo "then paste turn:<PC-LAN-IP>:3478 into TAZIA on this phone."
echo

if ! command -v pkg >/dev/null 2>&1; then
  echo "Run this inside Termux (F-Droid / Play)."
  exit 1
fi

LAN_IP="$(ip -4 addr show wlan0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 || true)"
if [[ -z "${LAN_IP}" ]]; then
  LAN_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' || true)"
fi

echo "Detected LAN IP: ${LAN_IP:-unknown}"
echo

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "Docker is available in this environment."
  echo "Clone the TAZIA repo, then:"
  echo "  cd docker/coturn"
  echo "  EXTERNAL_IP=${LAN_IP:-YOUR_LAN_IP} TURN_PASS=\$(openssl rand -hex 12) \\"
  echo "    docker compose up -d"
  exit 0
fi

echo "No Docker engine here (normal on stock Android)."
echo
echo "Options:"
echo "  1) Best: PC/Mac installer on the same Wi‑Fi (recommended)."
echo "  2) Root + userland Docker (high friction, unsupported)."
echo "  3) Use a small VPS coturn when peers are not on your LAN."
echo
echo "This script will not install a background TURN daemon on Android."
exit 2
