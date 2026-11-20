#!/bin/bash
# Double-click on macOS (may need: chmod +x TaziaTurn.command)
cd "$(dirname "$0")"
mkdir -p dist
ARCH="$(uname -m)"
BIN="dist/tazia-turn-darwin-arm64"
[[ "$ARCH" == "x86_64" ]] && BIN="dist/tazia-turn-darwin-amd64"
if [[ ! -x "$BIN" ]]; then
  echo "Building…"
  ./build/build-desktop.sh
fi
echo "Starting TAZIA Turn — leave this window open."
echo "Paste the card into TAZIA → Zones → Fix, then rejoin the zone."
exec "$BIN" "$@"
