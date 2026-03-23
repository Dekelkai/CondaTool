param(
  [string]$Python = "python"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = $scriptDir
$projectRoot = Resolve-Path (Join-Path $backendDir "..")
$runtimeDir = Join-Path $projectRoot "src-tauri\resources\runtime"
$entry = Join-Path $backendDir "main.py"
$distDir = Join-Path $backendDir "dist"
$buildDir = Join-Path $backendDir "build"
$specPath = Join-Path $backendDir "backend.spec"

if (!(Test-Path $entry)) {
  throw "backend entry not found: $entry"
}

Write-Host "[1/4] Ensuring pyinstaller is available..."
& $Python -m pip show pyinstaller *> $null
if ($LASTEXITCODE -ne 0) {
  & $Python -m pip install pyinstaller
}

Write-Host "[2/4] Building backend.exe..."
Push-Location $backendDir
& $Python -m PyInstaller --clean --noconfirm --onefile --name backend main.py
Pop-Location

$backendExe = Join-Path $distDir "backend.exe"
if (!(Test-Path $backendExe)) {
  throw "build failed: $backendExe not found"
}

Write-Host "[3/4] Copying backend.exe to runtime folder..."
New-Item -ItemType Directory -Force $runtimeDir | Out-Null
Copy-Item -Force $backendExe (Join-Path $runtimeDir "backend.exe")

Write-Host "[4/4] Done."
Write-Host "Output: $(Join-Path $runtimeDir 'backend.exe')"

# Optional cleanup hints:
Write-Host "You may clean build artifacts manually if needed:"
Write-Host "  Remove-Item -Recurse -Force '$buildDir' '$distDir' '$specPath'"
