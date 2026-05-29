#!/usr/bin/env bash
# safe-debug-chrome.sh
# Launch an ISOLATED Chrome with the CDP remote-debug port open.
# Safe-by-construction: dedicated throwaway profile + loopback-only port.
#
# WHY THIS IS SAFE:
#   - --user-data-dir points at a separate, throwaway profile. Its cookie jar
#     is fully isolated from your everyday Chrome, so your real Fidelity /
#     Gmail / banking sessions are NOT reachable from this instance.
#   - --remote-debugging-port binds to 127.0.0.1 (loopback) by default. We
#     deliberately DO NOT pass --remote-debugging-address. Never add it.
#   - Modern Chrome (M136+) also REFUSES remote debugging on the default
#     profile, so a dedicated --user-data-dir is required anyway.
#
# RULE: Only log into the ONE site you intend to sniff in this window.
#       Never Fidelity, banking, or email here.

set -euo pipefail

PORT="${CDP_PORT:-9222}"
PROFILE_DIR="${CDP_PROFILE:-$HOME/.cache/cdp-sniffer-profile}"

# macOS Chrome binary. For Linux, set CHROME=$(command -v google-chrome) etc.
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

if [[ ! -x "$CHROME" ]]; then
  echo "Chrome not found at: $CHROME" >&2
  echo "Set CHROME=/path/to/chrome and re-run." >&2
  exit 1
fi

mkdir -p "$PROFILE_DIR"

cat <<EOF
Launching ISOLATED debug Chrome
  port    : 127.0.0.1:${PORT}   (loopback only)
  profile : ${PROFILE_DIR}   (throwaway, separate cookie jar)

WARNING: Do NOT log Fidelity / banking / email into this window.
         Only the ONE site you intend to sniff.

Verify loopback bind in another terminal:
  lsof -nP -iTCP:${PORT} -sTCP:LISTEN
  -> must show 127.0.0.1:${PORT}, never *:${PORT}

EOF

exec "$CHROME" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --new-window
