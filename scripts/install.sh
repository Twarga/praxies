#!/usr/bin/env bash
set -euo pipefail

VERSION="0.1.0"
APP_NAME="Praxis"
INSTALL_ROOT="${PRAXIS_INSTALL_ROOT:-${HOME}/.local/share/praxis}"
BIN_DIR="${PRAXIS_BIN_DIR:-${HOME}/.local/bin}"
APPS_DIR="${PRAXIS_APPS_DIR:-${HOME}/.local/share/applications}"
artifact=""
checksum=""
signature=""
public_key="${PRAXIS_MINISIGN_PUBLIC_KEY:-}"
no_launch=0
mode=install

usage() {
  cat <<EOF
Praxis ${VERSION} Linux installer

Usage: install.sh [options]
  --artifact PATH|URL    AppImage to install
  --checksum PATH|URL    SHA-256 file (defaults to ARTIFACT.sha256)
  --signature PATH|URL   minisign signature (requires --public-key)
  --public-key KEY       minisign public key
  --check                Check an existing installation without changing it
  --uninstall            Remove app files, never journals or downloaded models
  --no-launch            Install without launching onboarding
  --version              Print installer version
  -h, --help             Show this help
EOF
}

die() { echo "Praxis installer: $*" >&2; exit 1; }
note() { printf '  %-22s %s\n' "$1" "$2"; }
fetch() {
  local source="$1" target="$2"
  if [[ "$source" =~ ^https:// ]]; then
    command -v curl >/dev/null || die "curl is required to download a release"
    curl --fail --location --proto '=https' --tlsv1.2 "$source" --output "$target"
  else
    cp "${source#file://}" "$target"
  fi
}

while (($#)); do
  case "$1" in
    --artifact) artifact="${2:-}"; shift 2 ;;
    --checksum) checksum="${2:-}"; shift 2 ;;
    --signature) signature="${2:-}"; shift 2 ;;
    --public-key) public_key="${2:-}"; shift 2 ;;
    --check|--check-only) mode=check; shift ;;
    --uninstall) mode=uninstall; shift ;;
    --no-launch) no_launch=1; shift ;;
    --version) echo "$VERSION"; exit 0 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

[[ "$(uname -s)" == Linux ]] || die "only Linux is supported"
case "$(uname -m)" in x86_64|amd64) ;; *) die "only Linux x86_64 is supported" ;; esac

launcher="${BIN_DIR}/praxis"
desktop="${APPS_DIR}/praxis.desktop"
manifest="${INSTALL_ROOT}/install.env"

if [[ "$mode" == uninstall ]]; then
  rm -f "$launcher" "$desktop"
  rm -rf "$INSTALL_ROOT"
  command -v update-desktop-database >/dev/null && update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true
  echo "Praxis application files removed. Journals, configuration, credentials, and model caches were preserved."
  exit 0
fi

if [[ "$mode" == check ]]; then
  failures=0
  [[ -r "$manifest" ]] || { note "Manifest" "missing"; failures=1; }
  [[ -x "$launcher" ]] || { note "Launcher" "missing"; failures=1; }
  [[ -r "$desktop" ]] || { note "Desktop entry" "missing"; failures=1; }
  if [[ -r "$manifest" ]]; then
    # shellcheck disable=SC1090
    source "$manifest"
    [[ -x "${PRAXIS_EXEC:-}" ]] || { note "Runtime" "missing"; failures=1; }
    note "Installed version" "${PRAXIS_VERSION:-unknown}"
    note "Runtime mode" "${PRAXIS_MODE:-unknown}"
  fi
  ((failures == 0)) || exit 1
  echo "Praxis installation is healthy."
  exit 0
fi

if [[ -z "$artifact" ]]; then
  artifact="$(find "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/frontend/release" -maxdepth 1 -name 'Praxis-*.AppImage' -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | sed -n '1s/^[^ ]* //p')"
fi
[[ -n "$artifact" ]] || die "provide --artifact PATH|URL or build a release first"

available_kb="$(df -Pk "$HOME" | awk 'NR==2 {print $4}')"
required_kb=2097152
((available_kb >= required_kb)) || die "at least 2 GiB free disk space is required"

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
appimage="$tmp/Praxis.AppImage"
fetch "$artifact" "$appimage"
chmod +x "$appimage"

checksum="${checksum:-${artifact}.sha256}"
checksum_file="$tmp/Praxis.AppImage.sha256"
fetch "$checksum" "$checksum_file" || die "checksum is required and could not be loaded"
expected="$(awk 'NR==1 {print $1}' "$checksum_file")"
[[ "$expected" =~ ^[0-9a-fA-F]{64}$ ]] || die "invalid SHA-256 checksum file"
actual="$(sha256sum "$appimage" | awk '{print $1}')"
[[ "${actual,,}" == "${expected,,}" ]] || die "checksum verification failed"
note "Checksum" "verified"

if [[ -n "$signature" || -n "$public_key" ]]; then
  [[ -n "$signature" && -n "$public_key" ]] || die "signature verification requires both --signature and --public-key"
  command -v minisign >/dev/null || die "minisign is required for signature verification"
  sig_file="$tmp/Praxis.AppImage.minisig"; fetch "$signature" "$sig_file"
  minisign -Vm "$appimage" -x "$sig_file" -P "$public_key" >/dev/null
  note "Signature" "verified"
fi

mkdir -p "$INSTALL_ROOT" "$BIN_DIR" "$APPS_DIR"
installed_app="$INSTALL_ROOT/Praxis.AppImage"
cp "$appimage" "$installed_app"; chmod 0755 "$installed_app"
exec_path="$installed_app"; runtime_mode=appimage

# AppImage type 2 needs FUSE on some systems. Preserve a no-FUSE extraction fallback.
if ! "$installed_app" --appimage-version >/dev/null 2>&1; then
  rm -rf "$INSTALL_ROOT/squashfs-root"
  (cd "$INSTALL_ROOT" && "$installed_app" --appimage-extract >/dev/null) || die "AppImage cannot run and extraction fallback failed"
  exec_path="$INSTALL_ROOT/squashfs-root/AppRun"; runtime_mode=extracted
fi

ln -sfn "$exec_path" "$launcher"
icon="$INSTALL_ROOT/praxis.png"
if [[ "$runtime_mode" == extracted ]]; then
  found_icon="$(find "$INSTALL_ROOT/squashfs-root" -type f \( -name 'praxis.png' -o -name 'icon.png' \) | head -1 || true)"
  [[ -z "$found_icon" ]] || cp "$found_icon" "$icon"
fi
cat >"$desktop" <<EOF
[Desktop Entry]
Name=Praxis
Comment=Private local AI video journaling coach
Exec=${launcher}
Icon=${icon}
Terminal=false
Type=Application
Categories=AudioVideo;Education;
StartupNotify=true
EOF
chmod 0644 "$desktop"
cat >"$manifest" <<EOF
PRAXIS_VERSION='${VERSION}'
PRAXIS_EXEC='${exec_path}'
PRAXIS_MODE='${runtime_mode}'
EOF
command -v update-desktop-database >/dev/null && update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true

note "Installed" "$exec_path"
note "Launcher" "$launcher"
note "Desktop entry" "$desktop"
if ((no_launch == 0)); then
  unset ELECTRON_RUN_AS_NODE
  nohup "$launcher" >"${HOME}/.cache/praxis/installer-launch.log" 2>&1 &
  note "Onboarding" "launched"
fi
echo "Installation complete. Run '$0 --check' to verify or '$0 --uninstall' to remove app files."
