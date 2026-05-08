#!/usr/bin/env sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE="${1:-$HOME/.cache/whisper}"
TARGET="$ROOT/frontend/electron/resources/whisper"

if [ ! -d "$SOURCE" ]; then
  echo "Whisper cache source not found: $SOURCE" >&2
  exit 1
fi

mkdir -p "$TARGET"
rsync -a --delete "$SOURCE"/ "$TARGET"/
touch "$TARGET/.gitkeep"
echo "Pre-seeded Whisper cache: $TARGET"
