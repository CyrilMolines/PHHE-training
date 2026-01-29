from __future__ import annotations

import argparse
import concurrent.futures as cf
import os
from pathlib import Path

from tqdm import tqdm

from .csv_ingest import read_training_csv
from .discovery import discover_from_pages
from .graph import GraphAuth, SharePointTarget, acquire_token_device_code, resolve_list_id_by_title, resolve_site_id, iter_list_items_fields, list_columns, update_item_fields, create_list_item, send_mail
from .http_client import HttpConfig
from .link_check import check_url
from .reports import write_link_report_csv
from .sp_list import SharePointFieldMapping, normalize_from_graph_fields


def _cmd_link_check(args: argparse.Namespace) -> int:
    records = read_training_csv(args.input_csv)
    cfg = HttpConfig(timeout_seconds=float(args.timeout_seconds))

    max_workers = int(args.max_workers)
    rows = []

    def work(rec):
        return rec, check_url(rec.normalized_link, cfg=cfg)

    with cf.ThreadPoolExecutor(max_workers=max_workers) as ex:
        futs = [ex.submit(work, r) for r in records]
        for fut in tqdm(cf.as_completed(futs), total=len(futs), desc="Checking links"):
            rows.append(fut.result())

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


def _cmd_sp_inspect(args: argparse.Namespace) -> int:
    tenant_id = args.tenant_id or os.environ.get("WHO_TENANT_ID", "")
    client_id = args.client_id or os.environ.get("WHO_CLIENT_ID", "")
    if not tenant_id or not client_id:
        raise RuntimeError("Missing Graph auth. Provide --tenant-id/--client-id or set WHO_TENANT_ID/WHO_CLIENT_ID.")
    auth = GraphAuth(tenant_id=tenant_id, client_id=client_id)
    token = acquire_token_device_code(auth=auth, scopes=["Sites.Read.All"])
    target = SharePointTarget(hostname=args.hostname, site_path=args.site_path)
    site_id = resolve_site_id(token=token, target=target)
    list_title = args.list_title or os.environ.get("WHO_COPY_LIST_TITLE", "")
    if not list_title:
        raise RuntimeError("Missing list title. Provide --list-title or set WHO_COPY_LIST_TITLE.")
    list_id = resolve_list_id_by_title(token=token, site_id=site_id, list_title=list_title)
    cols = list_columns(token=token, site_id=site_id, list_id=list_id)
    print(f"site_id: {site_id}")
    print(f"list_id: {list_id}")
    print("columns:")
    for c in cols:
        print(f"- {c.get('name')} (displayName={c.get('displayName')})")
    return 0


def _cmd_sp_link_check(args: argparse.Namespace) -> int:
    mapping = SharePointFieldMapping()

    tenant_id = args.tenant_id or os.environ.get("WHO_TENANT_ID", "")
    client_id = args.client_id or os.environ.get("WHO_CLIENT_ID", "")
    if not tenant_id or not client_id:
        raise RuntimeError("Missing Graph auth. Provide --tenant-id/--client-id or set WHO_TENANT_ID/WHO_CLIENT_ID.")
    auth = GraphAuth(tenant_id=tenant_id, client_id=client_id)
    scopes = ["Sites.Read.All"] if not args.write_back else ["Sites.ReadWrite.All"]
    token = acquire_token_device_code(auth=auth, scopes=scopes)

    target = SharePointTarget(hostname=args.hostname, site_path=args.site_path)
    site_id = resolve_site_id(token=token, target=target)
    list_title = args.list_title or os.environ.get("WHO_COPY_LIST_TITLE", "")
    if not list_title:
        raise RuntimeError("Missing list title. Provide --list-title or set WHO_COPY_LIST_TITLE.")
    list_id = resolve_list_id_by_title(token=token, site_id=site_id, list_title=list_title)

    # Determine if writeback fields exist when requested.
    can_writeback = False
    if args.write_back:
        col_names = {str(c.get("name", "")).strip() for c in list_columns(token=token, site_id=site_id, list_id=list_id)}
        needed = {mapping.link_status, mapping.link_status_detail, mapping.last_checked_utc}
        can_writeback = needed.issubset(col_names)
        if not can_writeback:
            raise RuntimeError(
                "Write-back requested, but required fields are missing on the COPY list: "
                + ", ".join(sorted(needed - col_names))
            )

    cfg = HttpConfig(timeout_seconds=float(args.timeout_seconds))

    select_fields = [
        mapping.learning_name,
        mapping.description,
        mapping.technical_area,
        mapping.focus_area,
        mapping.intended_audience,
        mapping.owner,
        mapping.developer,
        mapping.contact_details,
        mapping.language,
        mapping.modality,
        mapping.platform,
        mapping.link,
        mapping.comment,
        mapping.signoff_status,
    ]

    rows = []
    idx = 0
    for item_id, fields in tqdm(
        iter_list_items_fields(token=token, site_id=site_id, list_id=list_id, select_fields=select_fields),
        desc="Fetching list items",
    ):
        idx += 1
        rec = normalize_from_graph_fields(source_row=idx, fields=fields, mapping=mapping)
        res = check_url(rec.normalized_link, cfg=cfg)
        rows.append((rec, res))

        if can_writeback:
            update_item_fields(
                token=token,
                site_id=site_id,
                list_id=list_id,
                item_id=item_id,
                fields={
                    mapping.link_status: "OK" if res.ok else "FAIL",
                    mapping.link_status_detail: ("" if res.ok else (res.error or f"status {res.status_code}"))[:255],
                    mapping.last_checked_utc: res.checked_at_utc.isoformat(),
                },
            )

    out_path = Path(args.output_csv)
    write_link_report_csv(out_path=out_path, rows=rows)
    print(f"Wrote link report: {out_path}")
    return 0


def _cmd_sp_upload_candidates(args: argparse.Namespace) -> int:
    import csv

    tenant_id = args.tenant_id or os.environ.get("WHO_TENANT_ID", "")
    client_id = args.client_id or os.environ.get("WHO_CLIENT_ID", "")
    if not tenant_id or not client_id:
        raise RuntimeError("Missing Graph auth. Provide --tenant-id/--client-id or set WHO_TENANT_ID/WHO_CLIENT_ID.")
    auth = GraphAuth(tenant_id=tenant_id, client_id=client_id)
    token = acquire_token_device_code(auth=auth, scopes=["Sites.ReadWrite.All"])
    target = SharePointTarget(hostname=args.hostname, site_path=args.site_path)
    site_id = resolve_site_id(token=token, target=target)
    candidates_list_title = args.candidates_list_title or os.environ.get("WHO_CANDIDATES_LIST_TITLE", "")
    if not candidates_list_title:
        raise RuntimeError("Missing candidates list title. Provide --candidates-list-title or set WHO_CANDIDATES_LIST_TITLE.")
    list_id = resolve_list_id_by_title(token=token, site_id=site_id, list_title=candidates_list_title)

    created = 0
    with Path(args.input_csv).open("r", encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        for row in tqdm(list(r), desc="Uploading candidates"):
            fields = {
                "Title": str(row.get("title", "")).strip()[:255] or "Candidate training",
                "LearningName": str(row.get("title", "")).strip()[:255],
                "SourceUrl": str(row.get("source_url", "")).strip(),
                "DetectedDate": str(row.get("detected_at_utc", "")).strip(),
                "ProposedDescription": str(row.get("description", "")).strip(),
                "ProposedTags": str(row.get("proposed_tags", "")).strip(),
                "ReasonMatched": str(row.get("reason_matched", "")).strip(),
                "Status": "New",
            }
            _ = create_list_item(token=token, site_id=site_id, list_id=list_id, fields=fields)
            created += 1

    print(f"Uploaded candidates: {created}")
    return 0


def _cmd_send_mail(args: argparse.Namespace) -> int:
    tenant_id = args.tenant_id or os.environ.get("WHO_TENANT_ID", "")
    client_id = args.client_id or os.environ.get("WHO_CLIENT_ID", "")
    if not tenant_id or not client_id:
        raise RuntimeError("Missing Graph auth. Provide --tenant-id/--client-id or set WHO_TENANT_ID/WHO_CLIENT_ID.")
    auth = GraphAuth(tenant_id=tenant_id, client_id=client_id)
    token = acquire_token_device_code(auth=auth, scopes=["Mail.Send"])
    body = Path(args.body_text_file).read_text(encoding="utf-8", errors="replace")
    send_mail(token=token, subject=args.subject, body_text=body, to_recipients=args.to)
    print("Email submitted (Graph sendMail).")
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
    link.add_argument("--max-workers", default="10", help="Parallel workers for link checking.")
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

    insp = sub.add_parser("sp-inspect", help="Inspect a SharePoint list (Graph) and print column names.")
    insp.add_argument("--tenant-id", required=False)
    insp.add_argument("--client-id", required=False)
    insp.add_argument("--hostname", required=True, help="SharePoint hostname, e.g. worldhealthorg.sharepoint.com")
    insp.add_argument("--site-path", required=True, help="Server-relative site path, e.g. /sites/EuroWCPHE")
    insp.add_argument("--list-title", required=False, help="List title to inspect (copy list).")
    insp.set_defaults(func=_cmd_sp_inspect)

    spchk = sub.add_parser("sp-link-check", help="Check links from a SharePoint list copy via Graph.")
    spchk.add_argument("--tenant-id", required=False)
    spchk.add_argument("--client-id", required=False)
    spchk.add_argument("--hostname", required=True)
    spchk.add_argument("--site-path", required=True)
    spchk.add_argument("--list-title", required=False)
    spchk.add_argument("--output-csv", required=True)
    spchk.add_argument("--timeout-seconds", default="20")
    spchk.add_argument(
        "--write-back",
        action="store_true",
        help="Update link status fields on the copy list (only if fields already exist).",
    )
    spchk.set_defaults(func=_cmd_sp_link_check)

    upl = sub.add_parser("sp-upload-candidates", help="Upload discovered candidates CSV to a candidates list.")
    upl.add_argument("--tenant-id", required=False)
    upl.add_argument("--client-id", required=False)
    upl.add_argument("--hostname", required=True)
    upl.add_argument("--site-path", required=True)
    upl.add_argument("--candidates-list-title", required=False)
    upl.add_argument("--input-csv", required=True, help="Candidates CSV produced by the discover command.")
    upl.set_defaults(func=_cmd_sp_upload_candidates)

    mail = sub.add_parser("send-mail", help="Send a text email via Graph (delegated).")
    mail.add_argument("--tenant-id", required=False)
    mail.add_argument("--client-id", required=False)
    mail.add_argument("--subject", required=True)
    mail.add_argument("--body-text-file", required=True)
    mail.add_argument("--to", action="append", required=True, help="Recipient email address (repeatable).")
    mail.set_defaults(func=_cmd_send_mail)

    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())

