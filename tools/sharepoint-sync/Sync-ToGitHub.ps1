#Requires -Version 5.1
<#
.SYNOPSIS
    Syncs WHO PHHE training list from SharePoint to GitHub.

.DESCRIPTION
    This script:
    1. Connects to SharePoint using your browser credentials
    2. Exports the training list to JSON
    3. Pushes to GitHub Pages

.EXAMPLE
    .\Sync-ToGitHub.ps1

.NOTES
    First run will prompt for SharePoint login via browser.
#>

param(
    [string]$SiteUrl = "https://worldhealthorg.sharepoint.com/sites/EuroWCPHE",
    [string]$ListName = "Copytraininglist2912026",
    [switch]$SkipGitPush
)

$ErrorActionPreference = "Stop"

# Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutputJson = Join-Path $ScriptDir "..\..\apps\finder-ui\public\demo-trainings.json"
$DistEmbed = Join-Path $ScriptDir "..\..\apps\finder-ui\dist-embed"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   WHO PHHE SharePoint -> GitHub Sync" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Source: $SiteUrl" -ForegroundColor Gray
Write-Host "  List:   $ListName" -ForegroundColor Gray
Write-Host ""

# Check for PnP.PowerShell module
if (-not (Get-Module -ListAvailable -Name "PnP.PowerShell")) {
    Write-Host "Installing PnP.PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name "PnP.PowerShell" -Scope CurrentUser -Force -AllowClobber
}

Import-Module PnP.PowerShell -ErrorAction Stop

# Connect to SharePoint (will open browser for auth)
Write-Host "Connecting to SharePoint..." -ForegroundColor Yellow
Write-Host "(A browser window will open for authentication)" -ForegroundColor Gray
Write-Host ""

try {
    # Use WebLogin - opens browser for standard SharePoint auth
    Connect-PnPOnline -Url $SiteUrl -UseWebLogin
    Write-Host "Connected successfully!" -ForegroundColor Green
} catch {
    Write-Host "Failed to connect: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Use the Data Export tool instead:" -ForegroundColor Yellow
    Write-Host "  1. Export CSV from SharePoint" -ForegroundColor Gray
    Write-Host "  2. Go to: https://cyrilmolines.github.io/PHHE-training/export/" -ForegroundColor Gray
    Write-Host "  3. Convert and upload to GitHub" -ForegroundColor Gray
    exit 1
}

# Get list items
Write-Host ""
Write-Host "Fetching training list..." -ForegroundColor Yellow

try {
    $items = Get-PnPListItem -List $ListName -PageSize 500
    Write-Host "Found $($items.Count) training records" -ForegroundColor Green
} catch {
    Write-Host "Failed to get list items: $_" -ForegroundColor Red
    Disconnect-PnPOnline
    exit 1
}

# Transform to JSON format
Write-Host ""
Write-Host "Transforming data..." -ForegroundColor Yellow

$trainings = @()
$index = 0

foreach ($item in $items) {
    $index++
    $fields = $item.FieldValues
    
    # Parse languages
    $languages = @()
    $langRaw = $fields["Language_x0028_s_x0029_"]
    if ($langRaw) {
        $languages = $langRaw -split "[,;/]" | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    }
    
    # Normalize modality
    $modalityRaw = if ($fields["Modality"]) { $fields["Modality"] } else { "" }
    $modality = switch -Regex ($modalityRaw.ToLower()) {
        "online.*person|person.*online" { "blended" }
        "online" { "online" }
        "person|face" { "in_person" }
        "toolkit|tool" { "toolkit" }
        default { "unknown" }
    }
    
    # Normalize link
    $link = if ($fields["Link"]) { $fields["Link"] } else { "" }
    $normalizedLink = $link.Trim()
    if ($normalizedLink -and -not $normalizedLink.StartsWith("http")) {
        $normalizedLink = "https://$normalizedLink"
    }
    
    # Build search text
    $searchParts = @(
        $fields["Title"],
        $fields["Description"],
        $fields["TechnicalArea"],
        $fields["FocusArea"],
        $fields["IntendedAudience"]
    ) + $languages
    $searchText = ($searchParts | Where-Object { $_ }) -join " "
    
    $training = [ordered]@{
        id = "training-$index"
        sourceRow = $index
        learningName = if ($fields["Title"]) { $fields["Title"] } else { "" }
        description = if ($fields["Description"]) { $fields["Description"] } else { "" }
        technicalArea = if ($fields["TechnicalArea"]) { $fields["TechnicalArea"] } else { "" }
        focusArea = if ($fields["FocusArea"]) { $fields["FocusArea"] } else { "" }
        intendedAudience = if ($fields["IntendedAudience"]) { $fields["IntendedAudience"] } else { "" }
        owner = if ($fields["Owner"]) { $fields["Owner"] } else { "" }
        developer = if ($fields["Developer"]) { $fields["Developer"] } else { "" }
        contactDetails = if ($fields["ContactDetails"]) { $fields["ContactDetails"] } else { "" }
        languages = $languages
        modalityRaw = $modalityRaw
        modality = $modality
        platform = if ($fields["Platform"]) { $fields["Platform"] } else { "" }
        link = $link
        normalizedLink = $normalizedLink
        comment = if ($fields["Comment"]) { $fields["Comment"] } else { "" }
        signoffStatus = if ($fields["Sign_x002d_offStatus"]) { $fields["Sign_x002d_offStatus"] } else { "" }
        searchText = $searchText.ToLower()
    }
    
    $trainings += $training
}

# Save JSON
Write-Host "Saving to: $OutputJson" -ForegroundColor Gray
$trainings | ConvertTo-Json -Depth 10 | Set-Content -Path $OutputJson -Encoding UTF8

Write-Host "Saved $($trainings.Count) trainings to JSON" -ForegroundColor Green

# Disconnect
Disconnect-PnPOnline

# Push to GitHub
if (-not $SkipGitPush) {
    Write-Host ""
    Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
    
    # Copy to dist-embed
    Copy-Item $OutputJson (Join-Path $DistEmbed "demo-trainings.json") -Force
    Copy-Item $OutputJson (Join-Path $DistEmbed "validator\demo-trainings.json") -Force
    Copy-Item $OutputJson (Join-Path $DistEmbed "discovery\demo-trainings.json") -Force
    
    Push-Location $DistEmbed
    try {
        git add -A
        $status = git status --porcelain
        if ($status) {
            $date = Get-Date -Format "yyyy-MM-dd"
            git commit -m "Update training data - $date"
            git push
            Write-Host "Pushed to GitHub successfully!" -ForegroundColor Green
            Write-Host "Changes will be live in ~2 minutes" -ForegroundColor Gray
        } else {
            Write-Host "No changes to push (data unchanged)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "Git push failed: $_" -ForegroundColor Red
        Write-Host "You may need to push manually" -ForegroundColor Yellow
    }
    Pop-Location
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "              SYNC COMPLETE" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
