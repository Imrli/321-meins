# Erstellt das private GitHub-Repository "321-meins", verknuepft es als "origin"
# und pusht den aktuellen Branch.
#
# Voraussetzung (einmalig im Terminal):
#   gh auth login
#   (HTTPS empfohlen, Anmeldung im Browser)
#
# Ausfuehren (PowerShell), im Projektroot oder beliebig:
#   powershell -ExecutionPolicy Bypass -File .\scripts\github-create-private-321-meins.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) {
    $ProjectRoot = "c:\Users\ADMIN\Documents\Projekte_Cursor\321meins"
}

$git = "C:\Program Files\Git\bin\git.exe"
if (-not (Test-Path $git)) { $git = "git" }

Set-Location $ProjectRoot

# gh schreibt bei Fehler auf stderr; mit "Stop" wuerde das sonst abbrechen
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
$null = gh auth status -h github.com 2>&1
$authOk = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $prevEap

if (-not $authOk) {
    Write-Host "Fehler: Bei GitHub ist noch niemand angemeldet." -ForegroundColor Red
    Write-Host "Bitte zuerst ausfuehren:  gh auth login" -ForegroundColor Yellow
    exit 1
}

$hasOrigin = $false
$null = & $git remote get-url origin 2>&1
if ($?) { $hasOrigin = $true }

if ($hasOrigin) {
    Write-Host "Remote 'origin' existiert bereits. Pushe..." -ForegroundColor Cyan
    $branch = (& $git branch --show-current).Trim()
    & $git push -u origin $branch
    exit $LASTEXITCODE
}

Write-Host "Erstelle privates Repo '321-meins' und pushe..." -ForegroundColor Cyan
gh repo create 321-meins --private --source=. --remote=origin --push
exit $LASTEXITCODE
