from __future__ import annotations

import csv
import io
from pathlib import Path

from .schema import TrainingRecord, normalize_record


def _strip_list_schema_preamble(raw: str) -> str:
    """
    This export begins with a 'ListSchema=...' line that is not part of the CSV table.
    The actual header row begins with '"Learning Name",...'.
    """
    # Fast path: header begins at a line starting with "Learning Name"
    lines = raw.splitlines(keepends=True)
    for i, line in enumerate(lines):
        if line.lstrip().startswith('"Learning Name"'):
            return "".join(lines[i:])
    # If not found, return raw and let csv raise a useful error downstream.
    return raw


def read_training_csv(path: str | Path) -> list[TrainingRecord]:
    p = Path(path)
    raw = p.read_text(encoding="utf-8", errors="replace")
    csv_text = _strip_list_schema_preamble(raw)

    # Use csv module for RFC4180 compliance including embedded newlines in quoted fields.
    f = io.StringIO(csv_text, newline="")
    reader = csv.DictReader(f)
    if reader.fieldnames is None:
        raise ValueError("CSV has no header row after stripping ListSchema preamble.")

    records: list[TrainingRecord] = []
    for idx, row in enumerate(reader, start=1):
        # idx is 1-based after header; keep it for traceability.
        rec = normalize_record(source_row=idx, row={k: (v or "") for k, v in row.items()})
        # Skip completely empty rows.
        if not (rec.learning_name or rec.normalized_link):
            continue
        records.append(rec)
    return records

