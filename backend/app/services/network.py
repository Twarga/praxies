from __future__ import annotations

import socket


def detect_lan_ip() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("8.8.8.8", 80))
            address = probe.getsockname()[0]
            if _is_usable_lan_ip(address):
                return address
    except OSError:
        pass

    try:
        hostname = socket.gethostname()
        for family, _, _, _, sockaddr in socket.getaddrinfo(hostname, None, socket.AF_INET):
            if family != socket.AF_INET:
                continue
            address = sockaddr[0]
            if _is_usable_lan_ip(address):
                return address
    except OSError:
        return None

    return None


def build_upload_url(lan_ip: str | None, port: int | None) -> str | None:
    if not lan_ip or not port:
        return None
    return f"http://{lan_ip}:{port}/upload"


def _is_usable_lan_ip(address: str | None) -> bool:
    if not address:
        return False
    return not address.startswith(("127.", "169.254."))
