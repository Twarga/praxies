#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PRAXIS_PYTHON:-$ROOT/.venv/bin/python}"
RUNTIME_ROOT="$ROOT/frontend/electron/resources/backend-runtime"
BUILD_ROOT="$ROOT/.build/backend-runtime"

[[ -x "$PYTHON" ]] || { echo "Python environment missing. Run ./scripts/install.sh first." >&2; exit 1; }

rm -rf "$RUNTIME_ROOT" "$BUILD_ROOT"
mkdir -p "$RUNTIME_ROOT" "$BUILD_ROOT"

"$PYTHON" -m PyInstaller \
  --noconfirm --clean --onedir \
  --name praxis-backend \
  --distpath "$RUNTIME_ROOT" \
  --workpath "$BUILD_ROOT/work" \
  --specpath "$BUILD_ROOT/spec" \
  --paths "$ROOT/backend" \
  --collect-all faster_whisper \
  --collect-all ctranslate2 \
  --collect-all litellm \
  "$ROOT/backend/launcher.py"

test -x "$RUNTIME_ROOT/praxis-backend/praxis-backend"
echo "Bundled backend runtime: $RUNTIME_ROOT/praxis-backend/praxis-backend"
