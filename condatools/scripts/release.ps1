param(
  [Parameter(Mandatory = $false)]
  [switch]$SkipBuildBackend,

  [Parameter(Mandatory = $false)]
  [switch]$SkipTauriBuild,

  [Parameter(Mandatory = $false)]
  [switch]$Sign,

  [Parameter(Mandatory = $false)]
  [ValidateSet("signtool", "trusted-signing")]
  [string]$SignMode = "signtool",

  [Parameter(Mandatory = $false)]
  [string]$CertificatePath,

  [Parameter(Mandatory = $false)]
  [string]$CertificatePassword
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
$backendBuildScript = Join-Path $projectRoot "backend\build_backend.ps1"
$prepareRuntimeScript = Join-Path $projectRoot "scripts\prepare_runtime.ps1"
$signScript = Join-Path $projectRoot "scripts\sign-release.ps1"

if (-not $SkipBuildBackend) {
  Write-Host "[1/5] Building backend runtime..." -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File $backendBuildScript
  if ($LASTEXITCODE -ne 0) {
    throw "Backend build failed."
  }
}

Write-Host "[2/5] Checking runtime files..." -ForegroundColor Cyan
& powershell -ExecutionPolicy Bypass -File $prepareRuntimeScript
if ($LASTEXITCODE -ne 0) {
  throw "Runtime preparation failed."
}

if ($Sign) {
  Write-Host "[3/5] Signing runtime artifacts before bundling..." -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File $signScript -Mode $SignMode -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword -SkipBundles
  if ($LASTEXITCODE -ne 0) {
    throw "Runtime signing step failed."
  }
} else {
  Write-Host "[3/5] Runtime signing skipped." -ForegroundColor Yellow
}

if (-not $SkipTauriBuild) {
  Write-Host "[4/5] Building Tauri bundles..." -ForegroundColor Cyan
  Push-Location $projectRoot
  npm run tauri build
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw "Tauri build failed."
  }
  Pop-Location
}

if ($Sign) {
  Write-Host "[5/5] Signing bundle artifacts..." -ForegroundColor Cyan
  & powershell -ExecutionPolicy Bypass -File $signScript -Mode $SignMode -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword -SkipRuntime
  if ($LASTEXITCODE -ne 0) {
    throw "Bundle signing step failed."
  }
} else {
  Write-Host "[5/5] Bundle signing skipped." -ForegroundColor Yellow
}

Write-Host "Release pipeline completed." -ForegroundColor Green
