from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .schema import TrainingRecord, normalize_record


@dataclass(frozen=True)
class SharePointFieldMapping:
    # Map from our canonical CSV header keys to list internal field names.
    learning_name: str = "field_2"
    description: str = "field_3"
    technical_area: str = "field_4"
    focus_area: str = "field_8"
    intended_audience: str = "field_11"
    owner: str = "field_5"
    developer: str = "field_7"
    contact_details: str = "field_6"
    language: str = "field_9"
    modality: str = "field_12"
    platform: str = "field_10"
    link: str = "field_14"
    comment: str = "field_17"
    signoff_status: str = "_Flow_SignoffStatus"

    # Optional: fields for link-check writeback (if present on the COPY list)
    link_status: str = "LinkStatus"
    link_status_detail: str = "LinkStatusDetail"
    last_checked_utc: str = "LastCheckedUTC"


def fields_to_row(fields: dict[str, Any], mapping: SharePointFieldMapping) -> dict[str, str]:
    def get(name: str) -> str:
        v = fields.get(name)
        if v is None:
            return ""
        return str(v)

    return {
        "Learning Name": get(mapping.learning_name),
        "Description": get(mapping.description),
        "Technical area": get(mapping.technical_area),
        "Focus area": get(mapping.focus_area),
        "Intended audience": get(mapping.intended_audience),
        "Owner": get(mapping.owner),
        "Developer": get(mapping.developer),
        "Contact details": get(mapping.contact_details),
        "Language": get(mapping.language),
        "Modality": get(mapping.modality),
        "Platform": get(mapping.platform),
        "Link": get(mapping.link),
        "Comment": get(mapping.comment),
        "Sign-off status": get(mapping.signoff_status),
    }


def normalize_from_graph_fields(
    *, source_row: int, fields: dict[str, Any], mapping: SharePointFieldMapping
) -> TrainingRecord:
    row = fields_to_row(fields, mapping)
    return normalize_record(source_row=source_row, row=row)

