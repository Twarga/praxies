#!/usr/bin/env sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

wait_for_url() {
  url="$1"
  attempts=0

  while [ "$attempts" -lt 100 ]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi

    attempts=$((attempts + 1))
    sleep 0.2
  done

  return 1
}

if [ "${1:-}" = "run" ]; then
  trap cleanup EXIT INT TERM

  (
    cd "$ROOT/backend"
    exec ../venv/bin/python -m uvicorn app.main:app --reload --port 8000
  ) &
  BACKEND_PID=$!

  (
    cd "$ROOT/frontend"
    exec npm run dev -- --host 127.0.0.1
  ) &
  FRONTEND_PID=$!

  echo "waiting for backend on http://127.0.0.1:8000/health"
  wait_for_url "http://127.0.0.1:8000/health"

  echo "waiting for frontend on http://127.0.0.1:5173"
  wait_for_url "http://127.0.0.1:5173"

  echo "launching electron"
  cd "$ROOT/frontend"
  exec npm run electron:dev
fi

echo "start backend in one terminal:"
echo "  cd \"$ROOT/backend\" && ../venv/bin/python -m uvicorn app.main:app --reload --port 8000"
echo
echo "start frontend in another terminal:"
echo "  cd \"$ROOT/frontend\" && npm install && npm run dev"
echo
echo "then launch electron from a third terminal:"
echo "  cd \"$ROOT/frontend\" && npm run electron:dev"
echo
echo "or run everything in one terminal:"
echo "  \"$ROOT/scripts/dev.sh\" run"
