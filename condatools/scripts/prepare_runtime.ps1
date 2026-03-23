$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
$runtimeDir = Join-Path $projectRoot "src-tauri\resources\runtime"

$required = @(
  "backend.exe",
  "micromamba.exe"
)

if (!(Test-Path $runtimeDir)) {
  throw "runtime directory not found: $runtimeDir"
}

$missing = @()
foreach ($file in $required) {
  $path = Join-Path $runtimeDir $file
  if (!(Test-Path $path)) {
    $missing += $path
  }
}

if ($missing.Count -gt 0) {
  Write-Host "Missing runtime files:" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host " - $_" }
  exit 1
}

Write-Host "Runtime files are ready:" -ForegroundColor Green
$required | ForEach-Object { Write-Host " - $(Join-Path $runtimeDir $_)" }
