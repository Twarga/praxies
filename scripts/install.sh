#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
artifact_arg=""
check_only=0
install_bin=1
install_desktop=1

usage() {
  cat <<'EOF'
Praxis AppImage installer

Usage:
  ./scripts/install.sh [--artifact PATH] [--check-only] [--no-bin] [--no-desktop]

Options:
  --artifact PATH   Install this AppImage instead of the latest frontend/release artifact.
  --check-only      Print readiness checks without copying files.
  --no-bin          Do not create ~/.local/bin/praxis.
  --no-desktop      Do not create ~/.local/share/applications/praxis.desktop.
  -h, --help        Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --artifact)
      artifact_arg="${2:-}"
      shift 2
      ;;
    --check-only)
      check_only=1
      shift
      ;;
    --no-bin)
      install_bin=0
      shift
      ;;
    --no-desktop)
      install_desktop=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

print_step() {
  echo
  echo "==> $*"
}

print_check() {
  printf '  %-28s %s\n' "$1" "$2"
}

warn() {
  echo "  warning: $*" >&2
}

find_latest_appimage() {
  find "${repo_root}/frontend/release" -maxdepth 1 -type f -name 'Praxis-*.AppImage' -printf '%T@ %p\n' 2>/dev/null \
    | sort -nr \
    | awk 'NR == 1 { $1=""; sub(/^ /, ""); print }'
}

resolve_path() {
  readlink -f "$1"
}

artifact="${artifact_arg:-$(find_latest_appimage)}"
if [[ -z "${artifact}" ]]; then
  echo "No AppImage artifact found." >&2
  echo "Build one first: ./scripts/release-linux.sh" >&2
  exit 1
fi

artifact="$(resolve_path "${artifact}")"
if [[ ! -f "${artifact}" ]]; then
  echo "AppImage artifact does not exist: ${artifact}" >&2
  exit 1
fi

version="$(basename "${artifact}" | sed -E 's/^Praxis-//; s/\.AppImage$//')"
install_dir="${HOME}/.local/share/praxis"
bin_dir="${HOME}/.local/bin"
apps_dir="${HOME}/.local/share/applications"
installed_app="${install_dir}/Praxis-${version}.AppImage"
launcher="${bin_dir}/praxis"
desktop_file="${apps_dir}/praxis.desktop"
icon_source="${repo_root}/logo.png"
icon_target="${install_dir}/logo.png"
config_file="${HOME}/.config/praxis/config.json"
backend_log="${HOME}/.cache/praxis/backend.log"
electron_log="${HOME}/.cache/praxis/electron.log"
whisper_cache="${HOME}/.cache/whisper"

echo "Praxis AppImage installer"
echo "========================="

print_step "Artifact"
chmod +x "${artifact}"
print_check "AppImage" "${artifact}"
print_check "Version" "${version}"
print_check "Size" "$(du -h "${artifact}" | awk '{print $1}')"

checksum_file="${artifact}.sha256"
if [[ -f "${checksum_file}" ]]; then
  if (cd "$(dirname "${artifact}")" && sha256sum -c "$(basename "${checksum_file}")" >/dev/null 2>&1); then
    print_check "Checksum" "ok"
  else
    warn "checksum verification failed for ${checksum_file}"
  fi
else
  warn "checksum file not found: ${checksum_file}"
fi

print_step "Runtime Paths"
print_check "Config" "${config_file}"
print_check "Backend log" "${backend_log}"
print_check "Electron log" "${electron_log}"
print_check "Whisper cache" "${whisper_cache}"

if [[ -f "${config_file}" ]]; then
  print_check "Config status" "exists"
else
  print_check "Config status" "will be created on first launch"
fi

if [[ -d "${whisper_cache}" ]]; then
  whisper_files="$(find "${whisper_cache}" -type f 2>/dev/null | wc -l | tr -d ' ')"
  whisper_size="$(du -sh "${whisper_cache}" 2>/dev/null | awk '{print $1}')"
  print_check "Whisper files" "${whisper_files}"
  print_check "Whisper cache size" "${whisper_size:-unknown}"
  if [[ "${whisper_files}" = "0" ]]; then
    warn "Whisper cache exists but contains no files. First transcription may download a model."
  fi
else
  warn "Whisper cache not found. First transcription may download the selected model."
fi

if [[ "${check_only}" = "1" ]]; then
  print_step "Check complete"
  echo "No files were installed because --check-only was used."
  exit 0
fi

print_step "Installing AppImage"
mkdir -p "${install_dir}"
cp "${artifact}" "${installed_app}"
chmod +x "${installed_app}"
print_check "Installed" "${installed_app}"

if [[ -f "${icon_source}" ]]; then
  cp "${icon_source}" "${icon_target}"
  print_check "Icon" "${icon_target}"
else
  warn "logo.png not found; desktop entry will use a generic icon."
fi

if [[ "${install_bin}" = "1" ]]; then
  mkdir -p "${bin_dir}"
  ln -sfn "${installed_app}" "${launcher}"
  print_check "CLI launcher" "${launcher}"
else
  print_check "CLI launcher" "skipped"
fi

if [[ "${install_desktop}" = "1" ]]; then
  mkdir -p "${apps_dir}"
  cat > "${desktop_file}" <<EOF
[Desktop Entry]
Name=Praxis
Comment=AI-assisted video journaling
Exec=${installed_app}
Icon=${icon_target}
Terminal=false
Type=Application
Categories=AudioVideo;Education;
StartupNotify=true
EOF
  chmod 0644 "${desktop_file}"
  print_check "Desktop entry" "${desktop_file}"

  if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "${apps_dir}" >/dev/null 2>&1 || true
  fi
else
  print_check "Desktop entry" "skipped"
fi

print_step "Launch"
if [[ "${install_bin}" = "1" ]]; then
  echo "Run from terminal:"
  echo "  praxis"
else
  echo "Run from terminal:"
  echo "  ${installed_app}"
fi
echo
echo "If Electron was launched from a shell that has ELECTRON_RUN_AS_NODE set:"
echo "  unset ELECTRON_RUN_AS_NODE"
echo
echo "Install complete."
