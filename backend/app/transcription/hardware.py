"""Hardware inspection for transcription recommendations."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

from app.models.schemas import HardwareInfo


def inspect_hardware() -> HardwareInfo:
    cpu_arch = os.uname().machine
    logical_cores = os.cpu_count() or 1

    total_ram_gb = 0
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    total_ram_gb = round(int(line.split()[1]) / (1024 * 1024), 1)
                    break
    except Exception:
        total_ram_gb = 0

    free_disk_gb = 0
    try:
        usage = shutil.disk_usage(Path.home())
        free_disk_gb = round(usage.free / (1024**3), 1)
    except Exception:
        free_disk_gb = 0

    gpu_vendor = ""
    gpu_name = ""
    try:
        import subprocess
        result = subprocess.run(
            ["lspci"],
            capture_output=True, text=True, check=False,
        )
        for line in result.stdout.splitlines():
            lower = line.lower()
            if "vga" in lower or "3d" in lower or "display" in lower:
                if "nvidia" in lower:
                    gpu_vendor = "nvidia"
                elif "amd" in lower or "ati" in lower:
                    gpu_vendor = "amd"
                elif "intel" in lower:
                    gpu_vendor = "intel"
                gpu_name = line.split(": ")[-1].strip() if ": " in line else line.strip()
                break
    except Exception:
        pass

    cuda_available = False
    try:
        result = __import__("subprocess").run(
            ["nvidia-smi"],
            capture_output=True, check=False,
        )
        cuda_available = result.returncode == 0
    except Exception:
        pass

    vulkan_available = False
    try:
        result = __import__("subprocess").run(
            ["vulkaninfo", "--summary"],
            capture_output=True, check=False,
        )
        vulkan_available = result.returncode == 0
    except Exception:
        pass

    return HardwareInfo(
        cpu_architecture=cpu_arch,
        logical_cores=logical_cores,
        total_ram_gb=total_ram_gb,
        gpu_vendor=gpu_vendor,
        gpu_name=gpu_name,
        cuda_available=cuda_available,
        vulkan_available=vulkan_available,
        free_disk_gb=free_disk_gb,
    )


def recommend_model(hardware: HardwareInfo) -> dict[str, object]:
    ram = hardware.total_ram_gb
    disk = hardware.free_disk_gb
    # Faster Whisper/CTranslate2 uses CUDA for GPU execution. Vulkan support
    # belongs to future engines such as whisper.cpp and must not select float16
    # for the current engine.
    has_gpu = hardware.cuda_available

    if ram >= 16 and disk >= 10:
        recommended = "large-v3-turbo"
        reason = "Plenty of RAM and disk for the best balance of speed and accuracy."
    elif ram >= 8 and disk >= 5:
        recommended = "medium"
        reason = "Sufficient RAM. Medium model balances quality and resource usage."
    elif ram >= 4 and disk >= 2:
        recommended = "base"
        reason = "Limited RAM. Base model is lightweight but still reasonably accurate."
    else:
        recommended = "tiny"
        reason = "Very limited resources. Tiny model runs everywhere but trades accuracy."

    return {
        "recommended_model": recommended,
        "reason": reason,
        "device": "cuda" if has_gpu else "cpu",
        "compute_type": "float16" if has_gpu else "int8",
        "alternatives": [m for m in ["large-v3-turbo", "medium", "small", "base", "tiny"] if m != recommended],
    }
