#!/usr/bin/env bash
set -euo pipefail

echo "Praxis installer"
echo "================"
echo ""

# Detect distribution
if [ -f /etc/os-release ]; then
  . /etc/os-release
  DISTRO="${ID:-unknown}"
else
  DISTRO="unknown"
fi

check_command() {
  command -v "$1" >/dev/null 2>&1
}

echo "Checking prerequisites..."

# Check Node.js
if check_command node; then
  NODE_VERSION=$(node --version | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 20 ]; then
    echo "  node $NODE_VERSION"
  else
    echo "  ERROR: Node.js 20+ required (found $NODE_VERSION)"
    exit 1
  fi
else
  echo "  ERROR: Node.js not found. Install Node.js 20+ first."
  exit 1
fi

# Check npm
if check_command npm; then
  echo "  npm $(npm --version)"
else
  echo "  ERROR: npm not found"
  exit 1
fi

# Check uv
if check_command uv; then
  echo "  uv $(uv --version | awk '{print $2}')"
else
  echo "  ERROR: uv not found. Install uv: https://docs.astral.sh/uv/getting-started/installation/"
  exit 1
fi

# Check FFmpeg
if check_command ffmpeg; then
  echo "  ffmpeg $(ffmpeg -version | head -n1 | awk '{print $3}')"
else
  echo "  ERROR: ffmpeg not found. Install ffmpeg first."
  exit 1
fi

# Check ffprobe
if check_command ffprobe; then
  echo "  ffprobe $(ffprobe -version | head -n1 | awk '{print $3}')"
else
  echo "  ERROR: ffprobe not found. Install ffmpeg first."
  exit 1
fi

echo ""
echo "Installing backend dependencies..."
uv sync

echo ""
echo "Installing frontend dependencies..."
cd frontend
npm install

echo ""
echo "Building frontend..."
npm run build

echo ""
echo "========================================"
echo "Praxis is ready for development."
echo ""
echo "To start the app:"
echo "  ./scripts/dev.sh run"
echo ""
echo "To build the AppImage:"
echo "  cd frontend && npm run electron:build"
echo "========================================"
