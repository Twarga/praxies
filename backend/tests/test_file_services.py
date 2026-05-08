from __future__ import annotations

import json
from datetime import datetime, timezone

from app.services.index import get_index_backup_file_path, get_index_file_path, load_or_rebuild_index
from app.services.json_io import overwrite_json_file, read_json_file, write_json_file
from app.services.sessions import create_session, update_session_meta


def test_write_and_read_json_file_round_trip(tmp_path):
    path = tmp_path / "nested" / "sample.json"

    write_json_file(path, {"hello": "world", "count": 2})

    assert path.exists()
    assert read_json_file(path) == {"hello": "world", "count": 2}


def test_overwrite_json_file_replaces_existing_payload(tmp_path):
    path = tmp_path / "payload.json"
    write_json_file(path, {"value": 1})

    overwrite_json_file(path, {"value": 2, "extra": True})

    assert read_json_file(path) == {"value": 2, "extra": True}


def test_load_or_rebuild_index_renames_corrupt_index_and_recovers(config):
    session = create_session(
        config,
        language="en",
        title="recover",
        created_at=datetime(2026, 5, 8, 9, 0, tzinfo=timezone.utc),
    )
    update_session_meta(config, session.id, updates={"status": "ready", "duration_seconds": 180})

    index_path = get_index_file_path(config)
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text("{not valid json\n", encoding="utf-8")

    rebuilt = load_or_rebuild_index(config, now=datetime(2026, 5, 8, 10, 0, tzinfo=timezone.utc))
    backup_path = get_index_backup_file_path(config)

    assert rebuilt.sessions[0].id == session.id
    assert backup_path.exists()
    assert "{not valid json" in backup_path.read_text(encoding="utf-8")
    assert json.loads(index_path.read_text(encoding="utf-8"))["sessions"][0]["id"] == session.id


def test_load_or_rebuild_index_replaces_existing_backup(config):
    index_path = get_index_file_path(config)
    backup_path = get_index_backup_file_path(config)
    index_path.parent.mkdir(parents=True, exist_ok=True)
    backup_path.write_text("old backup\n", encoding="utf-8")
    index_path.write_text("{broken\n", encoding="utf-8")

    rebuilt = load_or_rebuild_index(config, now=datetime(2026, 5, 8, 10, 0, tzinfo=timezone.utc))

    assert rebuilt.sessions == []
    assert backup_path.read_text(encoding="utf-8") == "{broken\n"
