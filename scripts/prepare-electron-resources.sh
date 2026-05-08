#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
frontend_dir="${repo_root}/frontend"
resources_dir="${frontend_dir}/electron/resources"
ffmpeg_dir="${resources_dir}/ffmpeg"
whisper_dir="${resources_dir}/whisper"
preseed_requested="${PRESEED_WHISPER:-0}"
preseed_source="${PRESEED_WHISPER_FROM:-}"

mkdir -p "${ffmpeg_dir}" "${whisper_dir}"

ffmpeg_bin="$(cd "${frontend_dir}" && node -e "process.stdout.write(require('ffmpeg-static'))" 2>/dev/null)"
ffprobe_bin="$(cd "${frontend_dir}" && node -e "process.stdout.write(require('ffprobe-static').path)" 2>/dev/null)"

if [[ -z "${ffmpeg_bin}" || ! -x "${ffmpeg_bin}" ]]; then
  echo "ffmpeg-static binary was not found. Run: cd frontend && npm install" >&2
  exit 1
fi

if [[ -z "${ffprobe_bin}" || ! -x "${ffprobe_bin}" ]]; then
  echo "ffprobe-static binary was not found. Run: cd frontend && npm install" >&2
  exit 1
fi

cp "${ffmpeg_bin}" "${ffmpeg_dir}/ffmpeg"
cp "${ffprobe_bin}" "${ffmpeg_dir}/ffprobe"
chmod +x "${ffmpeg_dir}/ffmpeg" "${ffmpeg_dir}/ffprobe"

echo "Prepared Electron ffmpeg resources in ${ffmpeg_dir}"

find "${whisper_dir}" -mindepth 1 ! -name '.gitkeep' -exec rm -rf {} +

if [[ -n "${preseed_source}" ]]; then
  if [[ ! -d "${preseed_source}" ]]; then
    echo "PRESEED_WHISPER_FROM does not exist: ${preseed_source}" >&2
    exit 1
  fi
  rsync -a --delete "${preseed_source}/" "${whisper_dir}/"
  touch "${whisper_dir}/.gitkeep"
  echo "Pre-seeded Whisper cache from ${preseed_source}"
elif [[ "${preseed_requested}" == "1" ]]; then
  default_cache="${HOME}/.cache/whisper"
  if [[ ! -d "${default_cache}" ]]; then
    echo "PRESEED_WHISPER=1 was requested, but no Whisper cache exists at ${default_cache}" >&2
    exit 1
  fi
  rsync -a --delete "${default_cache}/" "${whisper_dir}/"
  touch "${whisper_dir}/.gitkeep"
  echo "Pre-seeded Whisper cache from ${default_cache}"
else
  touch "${whisper_dir}/.gitkeep"
  echo "Whisper cache bundle left empty; first transcription will use local cache or download on demand."
fi

if [[ ! -x "${resources_dir}/python/bin/python" ]]; then
  echo "Python runtime is not present at ${resources_dir}/python/bin/python" >&2
  echo "Copy or build the portable Python runtime before producing a release artifact." >&2
fi
