#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JOURNAL_DIR="${1:-$ROOT/TwargaJournal}"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/praxis"
CONFIG_FILE="$CONFIG_DIR/config.json"

if [ ! -d "$JOURNAL_DIR" ]; then
  echo "ERROR: Journal folder not found: $JOURNAL_DIR" >&2
  exit 1
fi

mkdir -p "$CONFIG_DIR"

find_working_python() {
  for candidate in \
    "$ROOT/.venv/bin/python" \
    "$ROOT/frontend/electron/resources/python/bin/python3" \
    "python3"
  do
    if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c "import encodings" >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

PYTHON_BIN="$(find_working_python)" || {
  echo "ERROR: No working Python interpreter found." >&2
  exit 1
}

PYTHONPATH="$ROOT/backend" "$PYTHON_BIN" - "$JOURNAL_DIR" <<'PY'
import json
import sys
from pathlib import Path

from app.services.config import load_config, update_config

journal_dir = str(Path(sys.argv[1]).expanduser().resolve())
config = load_config()
update_config({"journal_folder": journal_dir})

print(f"Praxis config now points to: {journal_dir}")
print("OpenRouter API key was not changed.")
PY

echo "Config file: $CONFIG_FILE"
