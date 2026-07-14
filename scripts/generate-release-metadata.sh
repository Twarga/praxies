#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/frontend/package.json').version")"
RELEASE_DIR="$ROOT/frontend/release"
ARTIFACT="$RELEASE_DIR/Praxis-$VERSION.AppImage"
CHECKSUM="$ARTIFACT.sha256"
BASE_URL="${PRAXIS_RELEASE_BASE_URL:-https://github.com/Twarga/praxies/releases/download/v$VERSION}"

test -f "$ARTIFACT" && test -f "$CHECKSUM"
APPIMAGE_NAME="$(basename "$ARTIFACT")"
CHECKSUM_NAME="$(basename "$CHECKSUM")"
CHECKSUM_VALUE="$(awk 'NR==1 { print $1 }' "$CHECKSUM")"

cat > "$RELEASE_DIR/latest-linux.json" <<EOF
{
  "version": "$VERSION",
  "platform": "linux",
  "architecture": "x86_64",
  "appimage_url": "$BASE_URL/$APPIMAGE_NAME",
  "sha256_url": "$BASE_URL/$CHECKSUM_NAME",
  "sha256": "$CHECKSUM_VALUE"
}
EOF
