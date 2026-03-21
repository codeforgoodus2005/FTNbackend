#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3001}"

# Free the configured port before starting nodemon to avoid EADDRINUSE.
if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -tiTCP:${PORT} -sTCP:LISTEN || true)"
elif command -v fuser >/dev/null 2>&1; then
  PIDS="$(fuser -n tcp "${PORT}" 2>/dev/null || true)"
else
  PIDS=""
fi

if [[ -n "${PIDS}" ]]; then
  echo "Port ${PORT} is in use by: ${PIDS}"
  echo "Stopping existing process(es)..."
  kill -TERM ${PIDS} || true
  sleep 1

  if command -v lsof >/dev/null 2>&1; then
    REMAINING="$(lsof -tiTCP:${PORT} -sTCP:LISTEN || true)"
  elif command -v fuser >/dev/null 2>&1; then
    REMAINING="$(fuser -n tcp "${PORT}" 2>/dev/null || true)"
  else
    REMAINING=""
  fi

  if [[ -n "${REMAINING}" ]]; then
    echo "Force stopping remaining process(es): ${REMAINING}"
    kill -KILL ${REMAINING} || true
  fi
fi

exec nodemon server.js
