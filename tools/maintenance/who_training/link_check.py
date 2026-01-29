from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlparse

import requests

from .http_client import HttpConfig, HttpError, head_then_get
from .schema import LinkCheckResult


def _normalize_url(url: str) -> str:
    u = (url or "").strip()
    u = u.replace("&amp;", "&")
    return u


def _is_http_url(url: str) -> bool:
    try:
        p = urlparse(url)
    except Exception:
        return False
    return p.scheme in ("http", "https") and bool(p.netloc)


def check_url(url: str, *, cfg: HttpConfig) -> LinkCheckResult:
    checked_at = datetime.now(timezone.utc)
    u = _normalize_url(url)
    if not u:
        return LinkCheckResult(
            checked_at_utc=checked_at, ok=False, final_url="", status_code=None, error="empty url"
        )
    if not _is_http_url(u):
        return LinkCheckResult(
            checked_at_utc=checked_at,
            ok=False,
            final_url=u,
            status_code=None,
            error="not http/https url",
        )

    try:
        r = head_then_get(url=u, cfg=cfg)
        ok = 200 <= r.status_code < 400
        return LinkCheckResult(
            checked_at_utc=checked_at,
            ok=ok,
            final_url=str(r.url),
            status_code=int(r.status_code),
            error="",
        )
    except (requests.RequestException, HttpError) as e:
        return LinkCheckResult(
            checked_at_utc=checked_at,
            ok=False,
            final_url=u,
            status_code=None,
            error=str(e),
        )

