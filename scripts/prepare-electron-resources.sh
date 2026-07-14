#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"
RESOURCES="$FRONTEND/electron/resources"
mkdir -p "$RESOURCES/ffmpeg" "$RESOURCES/whisper"

ffmpeg_bin="$(cd "$FRONTEND" && node -e "process.stdout.write(require('ffmpeg-static'))")"
ffprobe_bin="$(cd "$FRONTEND" && node -e "process.stdout.write(require('ffprobe-static').path)")"
test -x "$ffmpeg_bin" && test -x "$ffprobe_bin"
install -m 0755 "$ffmpeg_bin" "$RESOURCES/ffmpeg/ffmpeg"
install -m 0755 "$ffprobe_bin" "$RESOURCES/ffmpeg/ffprobe"
touch "$RESOURCES/whisper/.gitkeep"
echo "Prepared FFmpeg and Whisper resource directories."
