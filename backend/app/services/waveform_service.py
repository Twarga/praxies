from __future__ import annotations

from array import array
from pathlib import Path
import math
import wave


DEFAULT_WAVEFORM_BAR_COUNT = 72
PCM_16BIT_PEAK = 32767


def build_waveform_bins(audio_path: str | Path, bar_count: int = DEFAULT_WAVEFORM_BAR_COUNT) -> list[float]:
    path = Path(audio_path)
    with wave.open(str(path), "rb") as wav_file:
        frame_count = wav_file.getnframes()
        channel_count = max(1, wav_file.getnchannels())
        sample_width = wav_file.getsampwidth()
        raw_frames = wav_file.readframes(frame_count)

    if frame_count <= 0 or not raw_frames:
        return [0.0] * bar_count

    if sample_width != 2:
        raise RuntimeError("Waveform generation expects 16-bit PCM audio.")

    samples = array("h")
    samples.frombytes(raw_frames)

    if channel_count > 1:
        mono_samples = array("h")
        for index in range(0, len(samples), channel_count):
            chunk = samples[index : index + channel_count]
            if not chunk:
                continue
            mono_samples.append(int(sum(chunk) / len(chunk)))
        samples = mono_samples

    if not samples:
        return [0.0] * bar_count

    total_samples = len(samples)
    window_size = max(1, math.ceil(total_samples / bar_count))
    bins: list[float] = []

    for start in range(0, total_samples, window_size):
        window = samples[start : start + window_size]
        if not window:
            bins.append(0.0)
            continue

        energy = sum(sample * sample for sample in window) / len(window)
        rms = math.sqrt(energy) / PCM_16BIT_PEAK
        bins.append(round(min(1.0, max(0.0, rms ** 0.65)), 4))

    if len(bins) < bar_count:
        bins.extend([0.0] * (bar_count - len(bins)))
    elif len(bins) > bar_count:
        bins = bins[:bar_count]

    return bins
