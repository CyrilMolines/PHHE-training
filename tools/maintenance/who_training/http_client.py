from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

import requests
from requests import Response
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential


@dataclass(frozen=True)
class HttpConfig:
    timeout_seconds: float = 20.0
    user_agent: str = "WHO-Training-Maintenance/0.1 (+local)"


class HttpError(RuntimeError):
    pass


def _session(cfg: HttpConfig) -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": cfg.user_agent})
    return s


@retry(
    retry=retry_if_exception_type((requests.RequestException, HttpError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    reraise=True,
)
def fetch(
    *,
    url: str,
    cfg: HttpConfig,
    method: str = "GET",
    allow_redirects: bool = True,
    stream: bool = False,
    headers: dict[str, str] | None = None,
) -> Response:
    s = _session(cfg)
    try:
        r = s.request(
            method=method,
            url=url,
            timeout=cfg.timeout_seconds,
            allow_redirects=allow_redirects,
            stream=stream,
            headers=headers,
        )
    except requests.RequestException as e:
        raise e
    if r.status_code >= 500:
        raise HttpError(f"Server error {r.status_code} for {url}")
    return r


def head_then_get(
    *,
    url: str,
    cfg: HttpConfig,
    extra_headers: dict[str, str] | None = None,
) -> Response:
    # Some sites do not support HEAD; fall back to GET.
    try:
        r = fetch(url=url, cfg=cfg, method="HEAD", allow_redirects=True, headers=extra_headers)
        return r
    except requests.RequestException:
        pass

    # GET but avoid downloading huge binaries by requesting a small range when supported.
    headers = dict(extra_headers or {})
    headers.setdefault("Range", "bytes=0-8191")
    r = fetch(url=url, cfg=cfg, method="GET", allow_redirects=True, stream=True, headers=headers)
    # Ensure connection is released quickly.
    try:
        _ = next(iter(r.iter_content(chunk_size=1024)), b"")
    except Exception:
        pass
    finally:
        r.close()
    return r


def multi_fetch_text(
    *,
    urls: Iterable[str],
    cfg: HttpConfig,
    max_bytes: int = 2_000_000,
) -> dict[str, str]:
    out: dict[str, str] = {}
    for u in urls:
        r = fetch(url=u, cfg=cfg, method="GET", allow_redirects=True, stream=True)
        try:
            buf = bytearray()
            for chunk in r.iter_content(chunk_size=8192):
                if not chunk:
                    continue
                buf.extend(chunk)
                if len(buf) >= max_bytes:
                    break
            out[u] = buf.decode("utf-8", errors="replace")
        finally:
            r.close()
    return out

