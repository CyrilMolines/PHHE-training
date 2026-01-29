## Maintenance tool (local, no custom servers)

This folder contains a Python tool to:
- **Check** that training links are reachable and report failures.
- **Discover** candidate trainings from configured seed pages and produce a candidates report.
- Optionally **read/write** SharePoint list items via **Microsoft Graph** (device-code sign-in).

### Install (Python)
From repo root:

```bash
python -m pip install -r tools/maintenance/requirements.txt
python -m pip install -r tools/maintenance/requirements-dev.txt
```

### Link checking (CSV export only; no tenant auth required)
This uses the CSV you already exported from SharePoint.

```bash
python -m tools.maintenance.who_training.cli link-check --input-csv "C:\Users\molinescy\OneDrive - World Health Organization\Code\Training-Hub\WHO Europe Humanitarian and Health Emergencies Training List.csv" --output-csv "C:\Users\molinescy\OneDrive - World Health Organization\Code\Training-Hub\tools\maintenance\reports\link-report.csv"
```

### Discovery (seed pages to candidates CSV)
Provide one or more `--seed-page` URLs (repeat the flag):

```bash
python -m tools.maintenance.who_training.cli discover --seed-page https://openwho.org/channels --output-csv "C:\Users\molinescy\OneDrive - World Health Organization\Code\Training-Hub\tools\maintenance\reports\candidates.csv"
```

### SharePoint/Graph operations (optional)
These commands require a tenant app registration that allows **device-code** delegated sign-in.

Commands:
- `sp-inspect`: prints list columns (helps you confirm internal field names)
- `sp-link-check`: reads the **copy list** via Graph and outputs a link report; `--write-back` updates status fields only if those fields already exist on the copy list
- `sp-upload-candidates`: uploads candidates CSV into a candidates list
- `send-mail`: sends a text email via Graph

Notes:
- For SharePoint list access, your app registration must have delegated permissions for the scopes you use (for example `Sites.Read.All` or `Sites.ReadWrite.All`).
- If you cannot get an app registration approved, you can still run **CSV-only** link checks and discovery and share the output report.

