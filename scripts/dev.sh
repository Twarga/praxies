#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${ROOT}/.venv/bin/python"
MODE="desktop"
BACKEND_PID=""
FRONTEND_PID=""
ELECTRON_PID=""

readonly BLUE='\033[38;5;75m'
readonly GREEN='\033[38;5;78m'
readonly AMBER='\033[38;5;221m'
readonly DIM='\033[2m'
readonly RESET='\033[0m'

banner() {
  printf '\n%b\n' "${BLUE}╭──────────────────────────────────────────╮${RESET}"
  printf '%b\n' "${BLUE}│${RESET}  ${GREEN}✦${RESET}  ${BLUE}Praxis development workspace${RESET}             ${BLUE}│${RESET}"
  printf '%b\n\n' "${BLUE}╰──────────────────────────────────────────╯${RESET}"
}

step() { printf '%b  %s%b\n' "${GREEN}✓${RESET}" "$1" "${RESET}"; }
info() { printf '%b  %s%b\n' "${DIM}" "$1" "${RESET}"; }
fail() { printf '%b  %s%b\n' "${AMBER}×${RESET}" "$1" "${RESET}" >&2; exit 1; }

usage() {
  cat <<EOF
Praxis development launcher

Usage:
  ./scripts/dev.sh          Start backend, frontend, and Electron
  ./scripts/dev.sh --web    Start backend and frontend only
  ./scripts/dev.sh --help   Show this help

Press Ctrl+C once to stop everything cleanly.
EOF
}

cleanup() {
  trap - EXIT INT TERM
  printf '\n%b\n' "${DIM}Stopping Praxis development services…${RESET}"
  for pid in "$ELECTRON_PID" "$FRONTEND_PID" "$BACKEND_PID"; do
    [[ -z "$pid" ]] || kill "$pid" 2>/dev/null || true
  done
  wait "$ELECTRON_PID" "$FRONTEND_PID" "$BACKEND_PID" 2>/dev/null || true
}

find_free_port() {
  "$PYTHON_BIN" - <<'PY'
import socket
with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PY
}

wait_for_url() {
  local url="$1" label="$2" attempts=0
  while (( attempts < 100 )); do
    if curl --fail --silent --show-error "$url" >/dev/null 2>&1; then
      step "$label is ready"
      return 0
    fi
    ((attempts += 1))
    sleep 0.2
  done
  fail "$label did not become ready. Check the logs above."
}

case "${1:-}" in
  ""|run) ;;
  --web) MODE="web" ;;
  -h|--help) usage; exit 0 ;;
  *) fail "Unknown option: $1. Run ./scripts/dev.sh --help" ;;
esac

[[ -x "$PYTHON_BIN" ]] || fail "Python environment missing. Run ./scripts/install.sh first."
command -v node >/dev/null || fail "Node.js is required. Run ./scripts/install.sh first."
command -v npm >/dev/null || fail "npm is required. Run ./scripts/install.sh first."
command -v curl >/dev/null || fail "curl is required to check service readiness."

if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  info "Installing frontend dependencies…"
  (cd "$ROOT/frontend" && npm install)
fi

BACKEND_PORT="${PRAXIS_BACKEND_PORT:-$(find_free_port)}"
FRONTEND_PORT="${PRAXIS_FRONTEND_PORT:-$(find_free_port)}"
BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}"
FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"

export PRAXIES_BACKEND_PORT="$BACKEND_PORT"
export PRAXIES_FRONTEND_URL="$FRONTEND_URL"
export PRAXIES_SKIP_BACKEND_LAUNCH="1"
export VITE_API_BASE_URL="$BACKEND_URL"

trap cleanup EXIT INT TERM
banner
info "Backend:  ${BACKEND_URL}"
info "Frontend: ${FRONTEND_URL}"
printf '\n'

(cd "$ROOT/backend" && exec "$PYTHON_BIN" -m uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT") &
BACKEND_PID=$!
wait_for_url "${BACKEND_URL}/health" "Local backend"

(cd "$ROOT/frontend" && exec npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort) &
FRONTEND_PID=$!
wait_for_url "$FRONTEND_URL" "Frontend"

if [[ "$MODE" == "web" ]]; then
  printf '\n%b\n' "${GREEN}Praxis web workspace is running.${RESET} Open ${FRONTEND_URL}"
  wait "$BACKEND_PID" "$FRONTEND_PID"
  exit 0
fi

printf '\n%b\n\n' "${GREEN}Launching Praxis desktop app…${RESET}"
(cd "$ROOT/frontend" && unset ELECTRON_RUN_AS_NODE && exec npm run electron:dev) &
ELECTRON_PID=$!
wait "$ELECTRON_PID"
