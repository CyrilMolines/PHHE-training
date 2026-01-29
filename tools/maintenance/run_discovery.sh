#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
out_path="${1:-"$repo_root/tools/maintenance/reports/candidates.csv"}"
timeout_seconds="${2:-20}"

shift || true
shift || true

args=(discover --output-csv "$out_path" --timeout-seconds "$timeout_seconds")
if [ "$#" -eq 0 ]; then
  args+=(--seed-page "https://openwho.org/channels")
else
  for s in "$@"; do
    args+=(--seed-page "$s")
  done
fi

python -m tools.maintenance.who_training.cli "${args[@]}"
echo "Wrote: $out_path"

