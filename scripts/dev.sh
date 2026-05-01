#!/usr/bin/env sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON_BIN="$ROOT/.venv/bin/python"
BACKEND_PID=""
FRONTEND_PID=""

if [ ! -x "$PYTHON_BIN" ]; then
  PYTHON_BIN="python3"
fi

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

find_free_port() {
  "$PYTHON_BIN" - <<'PY'
import socket

sock = socket.socket()
sock.bind(("127.0.0.1", 0))
print(sock.getsockname()[1])
sock.close()
PY
}

if [ "${1:-}" = "run" ]; then
  trap cleanup EXIT INT TERM

  BACKEND_PORT="${PRAXIES_BACKEND_PORT:-$(find_free_port)}"
  FRONTEND_PORT="${PRAXIES_FRONTEND_PORT:-$(find_free_port)}"
  BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
  FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"

  export PRAXIES_BACKEND_PORT="$BACKEND_PORT"
  export PRAXIES_FRONTEND_URL="$FRONTEND_URL"
  export PRAXIES_SKIP_BACKEND_LAUNCH="1"
  export VITE_API_BASE_URL="$BACKEND_URL"

  (
    cd "$ROOT/backend"
    exec "$PYTHON_BIN" -m uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT"
  ) &
  BACKEND_PID=$!

  (
    cd "$ROOT/frontend"
    exec npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort
  ) &
  FRONTEND_PID=$!

  echo "waiting for backend on ${BACKEND_URL}/health"
  wait_for_url "${BACKEND_URL}/health"

  echo "waiting for frontend on ${FRONTEND_URL}"
  wait_for_url "${FRONTEND_URL}"

  echo "launching electron against ${FRONTEND_URL} and ${BACKEND_URL}"
  cd "$ROOT/frontend"
  unset ELECTRON_RUN_AS_NODE
  exec npm run electron:dev
fi

echo "start backend in one terminal:"
echo "  cd \"$ROOT/backend\" && \"$PYTHON_BIN\" -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
echo
echo "start frontend in another terminal:"
echo "  cd \"$ROOT/frontend\" && VITE_API_BASE_URL=http://127.0.0.1:8000 npm install && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"
echo
echo "then launch electron from a third terminal:"
echo "  cd \"$ROOT/frontend\" && PRAXIES_FRONTEND_URL=http://127.0.0.1:5173 npm run electron:dev"
echo
echo "or run everything in one terminal:"
echo "  \"$ROOT/scripts/dev.sh\" run"
