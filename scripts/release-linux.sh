#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
frontend_dir="${repo_root}/frontend"
resources_dir="${frontend_dir}/electron/resources"
electron_log="${HOME}/.cache/praxis/electron.log"
smoke_timeout="${RELEASE_SMOKE_TIMEOUT:-25s}"

run_step() {
  echo
  echo "==> $*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_file() {
  if [[ ! -e "$1" ]]; then
    echo "Missing required file: $1" >&2
    exit 1
  fi
}

require_executable() {
  if [[ ! -x "$1" ]]; then
    echo "Missing required executable: $1" >&2
    exit 1
  fi
}

require_command node
require_command npm
require_command sha256sum
require_command timeout

if [[ "${SKIP_TESTS:-0}" != "1" ]]; then
  require_command uv
fi

run_step "Preparing bundled Electron resources"
"${script_dir}/prepare-electron-resources.sh"

require_executable "${resources_dir}/python/bin/python"
require_executable "${resources_dir}/ffmpeg/ffmpeg"
require_executable "${resources_dir}/ffmpeg/ffprobe"
require_file "${resources_dir}/whisper/.gitkeep"

if [[ -n "${PRESEED_WHISPER_FROM:-}" || "${PRESEED_WHISPER:-0}" == "1" ]]; then
  whisper_file_count="$(find "${resources_dir}/whisper" -type f ! -name '.gitkeep' | wc -l | tr -d ' ')"
  if [[ "${whisper_file_count}" == "0" ]]; then
    echo "Whisper preseed was requested, but no model files were bundled." >&2
    exit 1
  fi
  run_step "Bundled Whisper cache"
  echo "Bundled ${whisper_file_count} Whisper cache files into the AppImage resources."
fi

run_step "Checking bundled Python imports"
"${resources_dir}/python/bin/python" - <<'PY'
import fastapi
import faster_whisper
import litellm

print("bundled Python imports ok")
PY

if [[ "${SKIP_TESTS:-0}" != "1" ]]; then
  run_step "Running backend test suite"
  (cd "${repo_root}" && uv run pytest -q)
else
  echo
  echo "==> Skipping backend tests because SKIP_TESTS=1"
fi

run_step "Building Linux AppImage"
(cd "${frontend_dir}" && npm run electron:build)

version="$(node -p "require('${frontend_dir}/package.json').version")"
artifact="${frontend_dir}/release/Praxis-${version}.AppImage"
checksum_file="${artifact}.sha256"

require_executable "${artifact}"

run_step "Writing SHA-256 checksum"
(cd "$(dirname "${artifact}")" && sha256sum "$(basename "${artifact}")" > "$(basename "${checksum_file}")")
cat "${checksum_file}"

if [[ "${SKIP_SMOKE:-0}" != "1" ]]; then
  run_step "Smoke testing AppImage launch"
  mkdir -p "$(dirname "${electron_log}")"
  touch "${electron_log}"
  before_lines="$(wc -l < "${electron_log}" | tr -d ' ')"

  set +e
  (
    cd "${frontend_dir}"
    unset ELECTRON_RUN_AS_NODE
    timeout "${smoke_timeout}" "${artifact}"
  )
  smoke_status=$?
  set -e

  new_log="$(tail -n "+$((before_lines + 1))" "${electron_log}" || true)"
  echo "${new_log}"

  if ! grep -q "main window loaded" <<<"${new_log}"; then
    echo "AppImage smoke test did not reach main window loaded." >&2
    exit 1
  fi

  if [[ "${smoke_status}" != "0" && "${smoke_status}" != "124" ]]; then
    echo "AppImage smoke test exited with unexpected status ${smoke_status}." >&2
    exit 1
  fi
else
  echo
  echo "==> Skipping AppImage smoke test because SKIP_SMOKE=1"
fi

echo
echo "Release artifact:"
echo "  ${artifact}"
echo "Checksum:"
echo "  ${checksum_file}"
