#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
csv_path="${1:-"$repo_root/WHO Europe Humanitarian and Health Emergencies Training List.csv"}"
out_path="${2:-"$repo_root/tools/maintenance/reports/link-report.csv"}"
max_workers="${3:-12}"
timeout_seconds="${4:-20}"

python -m tools.maintenance.who_training.cli link-check \
  --input-csv "$csv_path" \
  --output-csv "$out_path" \
  --max-workers "$max_workers" \
  --timeout-seconds "$timeout_seconds"

echo "Wrote: $out_path"

