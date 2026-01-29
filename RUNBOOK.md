## Runbook: operating WHO Training AI features (no custom servers)

This repository contains:
- `apps/finder-ui/`: SharePoint-hosted “Training Finder” UI
- `tools/maintenance/`: local maintenance tooling (link checking + discovery + optional Graph uploads)

## A) Manual daily link check (CSV export only)

### Inputs
- A current CSV export of the training list (SharePoint “Export to CSV”).

### Command
Run from repo root:

```bash
python -m tools.maintenance.who_training.cli link-check --input-csv "C:\Users\molinescy\OneDrive - World Health Organization\Code\Training-Hub\WHO Europe Humanitarian and Health Emergencies Training List.csv" --output-csv "C:\Users\molinescy\OneDrive - World Health Organization\Code\Training-Hub\tools\maintenance\reports\link-report.csv" --max-workers 12 --timeout-seconds 20
```

### Output
- CSV report written to `tools/maintenance/reports/link-report.csv`
  - `ok=false` indicates unreachable / invalid / empty URLs.

## B) Manual discovery of candidate trainings

### Command (example seed page)

```bash
python -m tools.maintenance.who_training.cli discover --seed-page https://openwho.org/channels --output-csv "C:\Users\molinescy\OneDrive - World Health Organization\Code\Training-Hub\tools\maintenance\reports\candidates.csv"
```

### Output
- `tools/maintenance/reports/candidates.csv` with candidate trainings and basic reasons.

## C) Optional: use Graph to read/write a SharePoint COPY list

This is optional. If you cannot obtain an app registration, you can still use sections A and B.

### Device-code sign-in
The Graph commands use device-code flow (you will be prompted with a code and a URL).

### Required environment variables (recommended)
Set these in the shell before running Graph commands:
- `WHO_TENANT_ID`
- `WHO_CLIENT_ID`
- `WHO_COPY_LIST_TITLE`
- `WHO_CANDIDATES_LIST_TITLE` (only needed for candidate uploads)

You may also pass `--tenant-id` and `--client-id` on the command line; if omitted, the tool reads `WHO_TENANT_ID` and `WHO_CLIENT_ID`.

### Inspect list columns (to confirm internal names)

```bash
python -m tools.maintenance.who_training.cli sp-inspect --hostname worldhealthorg.sharepoint.com --site-path /sites/EuroWCPHE
```

### Link check directly from the COPY list (Graph)

```bash
python -m tools.maintenance.who_training.cli sp-link-check --hostname worldhealthorg.sharepoint.com --site-path /sites/EuroWCPHE --output-csv "C:\Users\molinescy\OneDrive - World Health Organization\Code\Training-Hub\tools\maintenance\reports\sp-link-report.csv"
```

If you created the fields `LinkStatus`, `LinkStatusDetail`, `LastCheckedUTC` on the COPY list and you want the tool to write into them:

```bash
python -m tools.maintenance.who_training.cli sp-link-check --hostname worldhealthorg.sharepoint.com --site-path /sites/EuroWCPHE --output-csv "C:\Users\molinescy\OneDrive - World Health Organization\Code\Training-Hub\tools\maintenance\reports\sp-link-report.csv" --write-back
```

### Email a report (optional)
Create a plain text file containing the body, then run `send-mail` with:
- `--subject`
- `--body-text-file` (path to an existing text file)
- one or more `--to` recipients

## D) Scheduling (Windows Task Scheduler)

### Recommended approach
- Schedule a task that runs a PowerShell script which:
  - Activates your Python environment (or uses system `python`)
  - Runs `link-check`
  - (Optional) runs `discover`

### Notes
- The tool is network-bound; schedule off-peak if needed.
- Keep the output folder (reports) on OneDrive if you want automatic sharing/versioning.

