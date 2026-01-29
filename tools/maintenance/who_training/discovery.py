from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .http_client import HttpConfig, multi_fetch_text


@dataclass(frozen=True)
class CandidateTraining:
    detected_at_utc: datetime
    source_url: str
    title: str
    description: str
    link: str
    reason_matched: str
    proposed_tags: str


DEFAULT_KEYWORDS = [
    # Emergency / preparedness
    "health emergency",
    "public health emergency",
    "emergency preparedness",
    "emergency response",
    "incident management",
    "outbreak",
    "surveillance",
    "ihr",
    "international health regulations",
    "risk communication",
    "infodemic",
    "laboratory",
    "point of entry",
    "go.data",
    "goarn",
    "health cluster",
    "vaccines",
]


def _clean_text(s: str) -> str:
    s = s.replace("\u00a0", " ")
    s = s.strip()
    s = " ".join(s.split())
    return s


def _same_site(base_url: str, link: str) -> bool:
    try:
        a = urlparse(base_url)
        b = urlparse(link)
    except Exception:
        return False
    return a.netloc == b.netloc


def discover_from_pages(
    *,
    seed_pages: Iterable[str],
    cfg: HttpConfig,
    keywords: list[str] | None = None,
    require_same_site_links: bool = True,
) -> list[CandidateTraining]:
    kw = [k.lower() for k in (keywords or DEFAULT_KEYWORDS)]
    detected_at = datetime.now(timezone.utc)

    html_by_url = multi_fetch_text(urls=seed_pages, cfg=cfg)
    candidates: list[CandidateTraining] = []

    for page_url, html in html_by_url.items():
        soup = BeautifulSoup(html, "lxml")

        # Pull a page-level description to help matching.
        meta_desc = ""
        md = soup.find("meta", attrs={"name": "description"})
        if md and md.get("content"):
            meta_desc = _clean_text(str(md.get("content")))

        for a in soup.find_all("a"):
            href = a.get("href")
            if not href:
                continue
            link = urljoin(page_url, href)
            if not link.startswith(("http://", "https://")):
                continue
            if require_same_site_links and not _same_site(page_url, link):
                continue

            title = _clean_text(a.get_text(" ", strip=True))
            if not title or len(title) < 6:
                continue

            blob = f"{title}\n{meta_desc}".lower()
            matched = [k for k in kw if k in blob]
            if not matched:
                continue

            candidates.append(
                CandidateTraining(
                    detected_at_utc=detected_at,
                    source_url=page_url,
                    title=title,
                    description=meta_desc,
                    link=link,
                    reason_matched=f"matched keywords: {', '.join(matched[:6])}",
                    proposed_tags=", ".join(sorted(set(matched[:10]))),
                )
            )

    # De-dupe by link.
    uniq: dict[str, CandidateTraining] = {}
    for c in candidates:
        uniq.setdefault(c.link, c)
    return list(uniq.values())

