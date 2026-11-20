#!/usr/bin/env bash
# Smoke-test running TAZIA coturn (reads docker/coturn/.env).
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/install/macos/install-tazia-turn.sh" --test
