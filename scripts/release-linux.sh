#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PRAXIS_PYTHON:-$ROOT/.venv/bin/python}"
FRONTEND="$ROOT/frontend"
VERSION="$(node -p "require('$FRONTEND/package.json').version")"

[[ -x "$PYTHON" ]] || { echo "Python environment missing. Run ./scripts/install.sh first." >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required." >&2; exit 1; }

if [[ "${SKIP_TESTS:-0}" != "1" ]]; then
  "$PYTHON" -m pytest -q
  (cd "$FRONTEND" && npm test)
fi

"$ROOT/scripts/build-backend-runtime.sh"
"$ROOT/scripts/prepare-electron-resources.sh"
(cd "$FRONTEND" && npm run electron:build)

ARTIFACT="$FRONTEND/release/Praxis-$VERSION.AppImage"
test -x "$ARTIFACT"
(cd "$(dirname "$ARTIFACT")" && sha256sum "$(basename "$ARTIFACT")" > "$(basename "$ARTIFACT").sha256")
"$ROOT/scripts/generate-release-metadata.sh"
install -m 0755 "$ROOT/scripts/install.sh" "$FRONTEND/release/Praxis-install.sh"

echo "Release artifacts created in $FRONTEND/release"
