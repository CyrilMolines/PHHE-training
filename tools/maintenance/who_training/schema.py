from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal


def _clean_text(s: str) -> str:
    # SharePoint exports often contain non-breaking spaces and inconsistent spacing.
    s = s.replace("\u00a0", " ")
    s = s.strip()
    s = " ".join(s.split())
    return s


def _split_csv_list(s: str) -> list[str]:
    s = _clean_text(s)
    if not s:
        return []
    parts = [p.strip() for p in s.split(",")]
    return [p for p in parts if p]


Modality = Literal["online", "in_person", "blended", "self_paced", "toolkit", "unknown"]


def normalize_modality(raw: str) -> Modality:
    v = _clean_text(raw).lower()
    if not v:
        return "unknown"
    if v in {"online", "e-learning", "elearning"}:
        return "online"
    if v in {"in-person", "in person", "inperson"}:
        return "in_person"
    if v in {"blended"}:
        return "blended"
    if v in {"training toolkits and packages", "training toolkits", "toolkit", "toolkits"}:
        return "toolkit"
    # Keep unknown for anything not mapped (we still retain raw text).
    return "unknown"


@dataclass(frozen=True)
class TrainingRecord:
    source_row: int
    learning_name: str
    description: str
    technical_area: str
    focus_area: str
    intended_audience: str
    owner: str
    developer: str
    contact_details: str
    languages: tuple[str, ...]
    modality_raw: str
    modality: Modality
    platform: str
    link: str
    comment: str
    signoff_status: str

    # Derived fields
    normalized_title: str
    normalized_platform: str
    normalized_technical_area: str
    normalized_focus_area: str
    normalized_audience: str
    normalized_link: str
    search_text: str


def normalize_record(*, source_row: int, row: dict[str, str]) -> TrainingRecord:
    # Raw fields (match CSV header names)
    learning_name = _clean_text(row.get("Learning Name", ""))
    description = _clean_text(row.get("Description", ""))
    technical_area = _clean_text(row.get("Technical area", ""))
    focus_area = _clean_text(row.get("Focus area", ""))
    intended_audience = _clean_text(row.get("Intended audience", ""))
    owner = _clean_text(row.get("Owner", ""))
    developer = _clean_text(row.get("Developer", ""))
    contact_details = _clean_text(row.get("Contact details", ""))
    language_raw = row.get("Language", "")
    languages = tuple(_split_csv_list(language_raw))
    modality_raw = row.get("Modality", "")
    modality = normalize_modality(modality_raw)
    platform = _clean_text(row.get("Platform", ""))
    link = _clean_text(row.get("Link", ""))
    comment = _clean_text(row.get("Comment", ""))
    signoff_status = _clean_text(row.get("Sign-off status", ""))

    normalized_link = link.replace("&amp;", "&").strip()

    normalized_title = learning_name
    normalized_platform = platform.lower()
    normalized_technical_area = technical_area.lower()
    normalized_focus_area = focus_area.lower()
    normalized_audience = intended_audience.lower()

    # Search text includes the most semantically meaningful fields.
    search_text = " | ".join(
        [
            normalized_title,
            description,
            technical_area,
            focus_area,
            intended_audience,
            owner,
            developer,
            contact_details,
            ", ".join(languages),
            platform,
            normalized_link,
        ]
    ).lower()

    return TrainingRecord(
        source_row=source_row,
        learning_name=learning_name,
        description=description,
        technical_area=technical_area,
        focus_area=focus_area,
        intended_audience=intended_audience,
        owner=owner,
        developer=developer,
        contact_details=contact_details,
        languages=languages,
        modality_raw=_clean_text(modality_raw),
        modality=modality,
        platform=platform,
        link=link,
        comment=comment,
        signoff_status=signoff_status,
        normalized_title=normalized_title,
        normalized_platform=normalized_platform,
        normalized_technical_area=normalized_technical_area,
        normalized_focus_area=normalized_focus_area,
        normalized_audience=normalized_audience,
        normalized_link=normalized_link,
        search_text=search_text,
    )


@dataclass(frozen=True)
class LinkCheckResult:
    checked_at_utc: datetime
    ok: bool
    final_url: str
    status_code: int | None
    error: str

