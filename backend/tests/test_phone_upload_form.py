from __future__ import annotations

from fastapi.testclient import TestClient

import app.main as main_module


def test_get_upload_form_returns_disabled_page_when_phone_upload_off(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)

    with TestClient(main_module.app) as client:
        response = client.get("/upload")

    assert response.status_code == 403
    assert response.headers["content-type"].startswith("text/html")
    assert "Phone upload is disabled" in response.text
    assert "<form" not in response.text


def test_get_upload_form_returns_minimal_upload_form_when_enabled(config, monkeypatch):
    enabled_config = config.model_copy(update={"phone_upload_enabled": True})
    monkeypatch.setattr(main_module, "load_config", lambda: enabled_config)

    with TestClient(main_module.app) as client:
        response = client.get("/upload")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert '<form method="post" action="/upload" enctype="multipart/form-data">' in response.text
    assert 'name="file"' in response.text
    assert 'accept="video/*,audio/*"' in response.text
    assert 'name="language"' in response.text
    assert 'value="en"' in response.text
    assert 'value="fr"' in response.text
    assert 'value="es"' in response.text
    assert 'name="title"' in response.text
    assert 'name="save_mode"' in response.text
    assert 'value="full"' in response.text
    assert 'value="transcribe_only"' in response.text
    assert 'value="video_only"' in response.text


def test_get_upload_form_is_mobile_friendly(config, monkeypatch):
    enabled_config = config.model_copy(update={"phone_upload_enabled": True})
    monkeypatch.setattr(main_module, "load_config", lambda: enabled_config)

    with TestClient(main_module.app) as client:
        response = client.get("/upload")

    assert '<meta name="viewport" content="width=device-width, initial-scale=1">' in response.text
    assert "Uploads stay local" in response.text
