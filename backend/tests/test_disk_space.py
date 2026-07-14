"""Low disk space protection tests."""

from __future__ import annotations

from pathlib import Path

from app.services.disk_space import (
    check_space_or_warn,
    estimate_model_download_bytes,
    estimate_recording_finalization_bytes,
    free_disk_bytes,
    has_sufficient_space,
)


class TestDiskSpaceEstimation:
    def test_finalization_estimate_scales_with_input(self):
        small = estimate_recording_finalization_bytes(100_000)
        large = estimate_recording_finalization_bytes(10_000_000)
        assert large > small
        assert small > 100_000

    def test_model_download_estimate_scales_with_input(self):
        small = estimate_model_download_bytes(500_000_000)
        large = estimate_model_download_bytes(2_000_000_000)
        assert large > small
        assert small > 500_000_000

    def test_estimates_include_margin(self):
        raw = 1_000_000
        estimate = estimate_recording_finalization_bytes(raw)
        assert estimate > raw * 2


class TestDiskSpaceCheck:
    def test_current_directory_has_free_space(self):
        free = free_disk_bytes(Path("/tmp"))
        assert free > 0

    def test_sufficient_space_passes(self, tmp_path):
        free = free_disk_bytes(tmp_path)
        assert has_sufficient_space(tmp_path, free)

    def test_excessive_requirement_fails(self, tmp_path):
        impossible = 2**60
        assert not has_sufficient_space(tmp_path, impossible)

    def test_check_returns_structured_result(self, tmp_path):
        result = check_space_or_warn(tmp_path, 100, "test operation")
        assert "ok" in result
        assert "available_bytes" in result
        assert "required_bytes" in result
        assert result["operation"] == "test operation"

    def test_insufficient_space_generates_warning(self, tmp_path):
        enormous = 2**60
        result = check_space_or_warn(tmp_path, enormous, "huge operation")
        assert result["ok"] is False
        assert result["warning"] is not None
        assert result["deficit_bytes"] > 0

    def test_sufficient_space_no_warning(self, tmp_path):
        result = check_space_or_warn(tmp_path, 1, "tiny operation")
        assert result["ok"] is True
        assert result["warning"] is None

    def test_deficit_is_nonzero_when_short(self, tmp_path):
        available = free_disk_bytes(tmp_path)
        required = available + 1_000_000_000_000
        result = check_space_or_warn(tmp_path, required, "too big")
        assert result["deficit_bytes"] > 0
