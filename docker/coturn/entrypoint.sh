#!/bin/sh
# Inject credentials + external-ip into coturn without baking secrets into the image.
set -eu

CONF=/etc/coturn/turnserver.conf
RUNTIME=/tmp/turnserver.runtime.conf

if [ -z "${TURN_PASS:-}" ]; then
  echo "TURN_PASS is required" >&2
  exit 1
fi

USER_NAME="${TURN_USER:-tazia}"

# EXTERNAL_IP=auto | empty + DETECT_EXTERNAL_IP=1 → try public IP (WAN peers).
# Prefer the install scripts: they set the host LAN IP for same-Wi‑Fi use.
if [ "${EXTERNAL_IP:-}" = "auto" ]; then
  EXTERNAL_IP=""
fi

if [ -z "${EXTERNAL_IP:-}" ] && [ "${DETECT_EXTERNAL_IP:-0}" = "1" ]; then
  EXTERNAL_IP="$(wget -qO- https://api.ipify.org 2>/dev/null || true)"
fi

if [ -z "${EXTERNAL_IP:-}" ]; then
  echo "EXTERNAL_IP is required (LAN IP of this machine, e.g. 192.168.1.10)" >&2
  echo "Use docker/coturn/install/ (Windows bat / macOS sh) for zero-friction setup." >&2
  exit 1
fi

cp "$CONF" "$RUNTIME"
# Strip any prior injected lines so restarts stay idempotent.
grep -v -E '^(user=|external-ip=|verbose$)' "$RUNTIME" > "${RUNTIME}.clean"
mv "${RUNTIME}.clean" "$RUNTIME"

printf '\n# --- injected by entrypoint ---\n' >> "$RUNTIME"
printf 'user=%s:%s\n' "$USER_NAME" "$TURN_PASS" >> "$RUNTIME"
printf 'external-ip=%s\n' "$EXTERNAL_IP" >> "$RUNTIME"

if [ "${TURN_VERBOSE:-0}" = "1" ]; then
  printf 'verbose\n' >> "$RUNTIME"
fi

echo "coturn listening; realm=tazia.local user=${USER_NAME} external-ip=${EXTERNAL_IP}"
exec turnserver -c "$RUNTIME" --log-file=stdout
