from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

from tqdm import tqdm

from .csv_ingest import read_training_csv
from .discovery import discover_from_pages
from .http_client import HttpConfig
from .link_check import check_url
from .reports import write_link_report_csv


def _cmd_link_check(args: argparse.Namespace) -> int:
    records = read_training_csv(args.input_csv)
    cfg = HttpConfig(timeout_seconds=float(args.timeout_seconds))

    rows = []
    for rec in tqdm(records, desc="Checking links"):
        res = check_url(rec.normalized_link, cfg=cfg)
        rows.append((rec, res))

    out_path = Path(args.output_csv)
    write_link_report_csv(out_path=out_path, rows=rows)
    print(f"Wrote link report: {out_path}")
    return 0


def _cmd_discover(args: argparse.Namespace) -> int:
    cfg = HttpConfig(timeout_seconds=float(args.timeout_seconds))
    seeds = [s.strip() for s in args.seed_page if s.strip()]
    candidates = discover_from_pages(seed_pages=seeds, cfg=cfg)

    out_path = Path(args.output_csv)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    import csv

    with out_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "detected_at_utc",
                "source_url",
                "title",
                "description",
                "link",
                "reason_matched",
                "proposed_tags",
            ],
        )
        w.writeheader()
        for c in candidates:
            w.writerow(
                {
                    "detected_at_utc": c.detected_at_utc.isoformat(),
                    "source_url": c.source_url,
                    "title": c.title,
                    "description": c.description,
                    "link": c.link,
                    "reason_matched": c.reason_matched,
                    "proposed_tags": c.proposed_tags,
                }
            )

    print(f"Wrote candidates: {out_path} ({len(candidates)})")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="who-training-maintenance")
    sub = p.add_subparsers(dest="cmd", required=True)

    link = sub.add_parser("link-check", help="Check reachability of training links from CSV export.")
    link.add_argument(
        "--input-csv",
        required=True,
        help="Path to the SharePoint list CSV export file.",
    )
    link.add_argument(
        "--output-csv",
        required=True,
        help="Path to write the link-status report CSV.",
    )
    link.add_argument("--timeout-seconds", default="20", help="HTTP timeout per link.")
    link.set_defaults(func=_cmd_link_check)

    disc = sub.add_parser("discover", help="Discover candidate trainings from seed pages (HTML).")
    disc.add_argument(
        "--seed-page",
        action="append",
        required=True,
        help="Seed page URL to scan for candidate training links (repeatable).",
    )
    disc.add_argument(
        "--output-csv",
        required=True,
        help="Path to write candidate trainings CSV.",
    )
    disc.add_argument("--timeout-seconds", default="20", help="HTTP timeout per fetch.")
    disc.set_defaults(func=_cmd_discover)

    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())

