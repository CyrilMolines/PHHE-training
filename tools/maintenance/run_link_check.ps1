param(
  [string]$CsvPath = (Join-Path $PSScriptRoot "..\\..\\WHO Europe Humanitarian and Health Emergencies Training List.csv"),
  [string]$OutPath = (Join-Path $PSScriptRoot "reports\\link-report.csv"),
  [int]$MaxWorkers = 12,
  [int]$TimeoutSeconds = 20
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\\..")
$csv = Resolve-Path $CsvPath

python -m tools.maintenance.who_training.cli link-check `
  --input-csv "$csv" `
  --output-csv "$OutPath" `
  --max-workers $MaxWorkers `
  --timeout-seconds $TimeoutSeconds

Write-Host "Wrote: $OutPath"

