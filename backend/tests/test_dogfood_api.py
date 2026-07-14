from fastapi.testclient import TestClient

from app.main import app
from app.services.config import load_config, update_config


def test_checkin_stays_in_local_journal_and_updates_summary(tmp_path):
    update_config({"journal_folder": str(tmp_path)})
    client = TestClient(app)
    response = client.post("/api/dogfood/checkins", json={
        "session_id": "session-1",
        "understandable": True,
        "correction_accurate": False,
        "will_practice": True,
        "friction_notes": "The model setup was slow.",
    })
    assert response.status_code == 200
    assert response.json() == {"saved": True, "local_only": True}
    path = tmp_path / "_dogfood" / "entries.jsonl"
    assert path.is_file()
    assert "The model setup was slow." in path.read_text(encoding="utf-8")

    summary = client.get("/api/dogfood/weekly-summary")
    assert summary.status_code == 200
    assert summary.json()["checkins"] == 1
    assert summary.json()["ratings"]["understandable"] == "1/1"


def test_checkin_rejects_oversized_note():
    response = TestClient(app).post("/api/dogfood/checkins", json={
        "session_id": "session-1",
        "friction_notes": "x" * 501,
    })
    assert response.status_code == 422
