param(
  [string[]]$SeedPages = @("https://openwho.org/channels"),
  [string]$OutPath = (Join-Path $PSScriptRoot "reports\\candidates.csv"),
  [int]$TimeoutSeconds = 20
)

$ErrorActionPreference = "Stop"

$argsList = @("discover", "--output-csv", $OutPath, "--timeout-seconds", "$TimeoutSeconds")
foreach ($s in $SeedPages) {
  $argsList += @("--seed-page", $s)
}

python -m tools.maintenance.who_training.cli @argsList

Write-Host "Wrote: $OutPath"

