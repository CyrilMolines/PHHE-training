from __future__ import annotations

import csv
from dataclasses import asdict
from pathlib import Path
from typing import Iterable

from .schema import LinkCheckResult, TrainingRecord


def write_link_report_csv(
    *,
    out_path: str | Path,
    rows: Iterable[tuple[TrainingRecord, LinkCheckResult]],
) -> None:
    p = Path(out_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "source_row",
                "learning_name",
                "platform",
                "modality",
                "languages",
                "link",
                "final_url",
                "ok",
                "status_code",
                "checked_at_utc",
                "error",
            ],
        )
        w.writeheader()
        for rec, res in rows:
            w.writerow(
                {
                    "source_row": rec.source_row,
                    "learning_name": rec.learning_name,
                    "platform": rec.platform,
                    "modality": rec.modality,
                    "languages": ", ".join(rec.languages),
                    "link": rec.normalized_link,
                    "final_url": res.final_url,
                    "ok": "true" if res.ok else "false",
                    "status_code": "" if res.status_code is None else str(res.status_code),
                    "checked_at_utc": res.checked_at_utc.isoformat(),
                    "error": res.error,
                }
            )

