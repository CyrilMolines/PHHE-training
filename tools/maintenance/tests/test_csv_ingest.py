from __future__ import annotations

from pathlib import Path

from tools.maintenance.who_training.csv_ingest import read_training_csv


def test_read_training_csv_parses_records() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    csv_path = (
        repo_root / "WHO Europe Humanitarian and Health Emergencies Training List.csv"
    )
    recs = read_training_csv(csv_path)
    assert len(recs) > 0
    assert recs[0].learning_name


def test_read_training_csv_handles_embedded_newlines() -> None:
    # At least one row in the provided CSV has embedded newlines inside a quoted URL/description.
    repo_root = Path(__file__).resolve().parents[3]
    csv_path = (
        repo_root / "WHO Europe Humanitarian and Health Emergencies Training List.csv"
    )
    recs = read_training_csv(csv_path)
    assert any("\n" not in r.learning_name for r in recs)

