# Deploy the link-check API to Vercel (from repo root).
# Run once: npx vercel login
# Then run: .\scripts\deploy-api-vercel.ps1

Set-Location $PSScriptRoot\..

$env:VERCEL_ORG_ID = $env:VERCEL_ORG_ID  # optional, from .vercel/project.json after vercel link
$env:VERCEL_PROJECT_ID = $env:VERCEL_PROJECT_ID

Write-Host "If prompted for project name, use: training-hub" -ForegroundColor Yellow
npx vercel --prod --yes
