from __future__ import annotations

from fastapi.testclient import TestClient

import app.main as main_module
from app.services import config as config_service
from app.services import network


class FakeSocket:
    def __init__(self, address: str) -> None:
        self.address = address

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def connect(self, _target):
        return None

    def getsockname(self):
        return (self.address, 45678)


def test_detect_lan_ip_uses_udp_route_probe(monkeypatch):
    monkeypatch.setattr(
        network.socket,
        "socket",
        lambda *_args, **_kwargs: FakeSocket("192.168.1.42"),
    )

    assert network.detect_lan_ip() == "192.168.1.42"


def test_detect_lan_ip_rejects_loopback_and_link_local(monkeypatch):
    monkeypatch.setattr(
        network.socket,
        "socket",
        lambda *_args, **_kwargs: FakeSocket("127.0.0.1"),
    )
    monkeypatch.setattr(network.socket, "gethostname", lambda: "praxis")
    monkeypatch.setattr(
        network.socket,
        "getaddrinfo",
        lambda *_args, **_kwargs: [
            (network.socket.AF_INET, None, None, None, ("169.254.10.12", 0)),
            (network.socket.AF_INET, None, None, None, ("127.0.1.1", 0)),
        ],
    )

    assert network.detect_lan_ip() is None


def test_build_upload_url_requires_lan_ip_and_port():
    assert network.build_upload_url("192.168.1.42", 8765) == "http://192.168.1.42:8765/upload"
    assert network.build_upload_url(None, 8765) is None
    assert network.build_upload_url("192.168.1.42", None) is None


def test_get_config_includes_upload_url_when_phone_upload_enabled(config, monkeypatch):
    enabled_config = config.model_copy(update={"phone_upload_enabled": True})
    monkeypatch.setattr(main_module, "load_config", lambda: enabled_config)
    monkeypatch.setattr(config_service, "detect_lan_ip", lambda: "192.168.1.42")

    with TestClient(main_module.app, base_url="http://127.0.0.1:8765") as client:
        response = client.get("/api/config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["phone_upload_lan_ip"] == "192.168.1.42"
    assert payload["phone_upload_url"] == "http://192.168.1.42:8765/upload"


def test_get_config_hides_upload_url_when_phone_upload_disabled(config, monkeypatch):
    monkeypatch.setattr(main_module, "load_config", lambda: config)
    monkeypatch.setattr(config_service, "detect_lan_ip", lambda: "192.168.1.42")

    with TestClient(main_module.app, base_url="http://127.0.0.1:8765") as client:
        response = client.get("/api/config")

    assert response.status_code == 200
    payload = response.json()
    assert payload["phone_upload_lan_ip"] == "192.168.1.42"
    assert payload["phone_upload_url"] is None
