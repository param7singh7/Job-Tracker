#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
HOST="${HOST:-127.0.0.1}"

cd "$ROOT_DIR"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  EXISTING_PID="$(lsof -ti :"$PORT" | head -n 1)"
  if [ -n "${EXISTING_PID:-}" ]; then
    kill -9 "$EXISTING_PID" || true
  fi
fi

if [ -d ".next" ]; then
  mv .next ".next_recover_$(date +%s)"
fi

npm run dev -- --hostname "$HOST" --port "$PORT"
