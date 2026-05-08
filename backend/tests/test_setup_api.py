from __future__ import annotations

from fastapi.testclient import TestClient

import app.main as main_module
from app.core.settings import AppPaths
from app.services.config import load_config
from app.services.index import get_index_file_path
from app.services.sessions import create_session


def test_activate_journal_folder_validates_saves_and_rebuilds_index(config, monkeypatch, tmp_path):
    monkeypatch.setattr(main_module, "load_config", lambda: config)
    test_paths = AppPaths(
        home=tmp_path,
        config_dir=tmp_path,
        cache_dir=tmp_path,
        journal_dir=tmp_path / "DefaultJournal",
        config_file=tmp_path / "config.json",
        backend_log_file=tmp_path / "backend.log",
        runtime_socket=tmp_path / "runtime.sock",
        whisper_cache_dir=tmp_path / "whisper",
        legacy_config_dir=tmp_path / "legacy-config",
        legacy_cache_dir=tmp_path / "legacy-cache",
        legacy_journal_dir=tmp_path / "legacy-journal",
        legacy_config_file=tmp_path / "legacy-config" / "config.json",
    )

    def fake_update_config(patch):
        config.journal_folder = patch["journal_folder"]
        test_paths.config_file.write_text(config.model_dump_json(), encoding="utf-8")
        return config

    monkeypatch.setattr(main_module, "update_config", fake_update_config)
    next_journal = tmp_path / "PraxisVault"
    next_journal.mkdir()
    previous_folder = config.journal_folder
    config.journal_folder = str(next_journal)
    existing = create_session(config, language="en", title="existing")
    config.journal_folder = previous_folder

    with TestClient(main_module.app) as client:
        response = client.post(
            "/api/setup/activate-journal",
            json={"journal_folder": str(next_journal)},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["journal"]["ok"] is True
    assert payload["journal"]["session_count"] == 1
    assert payload["index"]["sessions"][0]["id"] == existing.id
    assert get_index_file_path(load_config(test_paths)).exists()
