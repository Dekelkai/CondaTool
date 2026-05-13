param(
  [Parameter(Mandatory = $false)]
  [string]$CertificatePath,

  [Parameter(Mandatory = $false)]
  [string]$CertificatePassword,

  [Parameter(Mandatory = $false)]
  [string]$TimestampUrl = "http://timestamp.digicert.com",

  [Parameter(Mandatory = $false)]
  [ValidateSet("signtool", "trusted-signing")]
  [string]$Mode = "signtool",

  [Parameter(Mandatory = $false)]
  [string]$TrustedSigningEndpoint,

  [Parameter(Mandatory = $false)]
  [string]$TrustedSigningAccount,

  [Parameter(Mandatory = $false)]
  [string]$TrustedSigningCertificateProfile,

  [Parameter(Mandatory = $false)]
  [string]$TrustedSigningDescription = "CondaTool",

  [Parameter(Mandatory = $false)]
  [string[]]$Files,

  [Parameter(Mandatory = $false)]
  [switch]$SkipRuntime,

  [Parameter(Mandatory = $false)]
  [switch]$SkipBundles
)

$ErrorActionPreference = "Stop"

function Get-SignToolPath {
  $command = Get-Command signtool -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "signtool.exe not found. Install Windows SDK Signing Tools first."
}

function Get-TrustedSigningCliPath {
  $command = Get-Command trusted-signing-cli -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "trusted-signing-cli not found. Install it with `cargo install trusted-signing-cli`."
}

function Get-DefaultFiles {
  param(
    [string]$ProjectRoot,
    [bool]$IncludeRuntime,
    [bool]$IncludeBundles
  )

  $targets = @()

  if ($IncludeRuntime) {
    $targets += @(
      (Join-Path $ProjectRoot "src-tauri\resources\runtime\backend.exe"),
      (Join-Path $ProjectRoot "src-tauri\resources\runtime\micromamba.exe")
    )
  }

  if ($IncludeBundles) {
    # 从 tauri.conf.json 动态读取版本号
    $tauriConfPath = Join-Path $ProjectRoot "src-tauri\tauri.conf.json"
    $version = "0.0.0"
    if (Test-Path $tauriConfPath) {
      $tauriConf = Get-Content $tauriConfPath -Raw | ConvertFrom-Json
      $version = $tauriConf.version
    }

    $targets += @(
      (Join-Path $ProjectRoot "src-tauri\target\release\condatools.exe"),
      (Join-Path $ProjectRoot "src-tauri\target\release\bundle\msi\CondaTool_${version}_x64_en-US.msi"),
      (Join-Path $ProjectRoot "src-tauri\target\release\bundle\nsis\CondaTool_${version}_x64-setup.exe")
    )
  }

  return $targets
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")

$signTool = $null
$trustedSigningCli = $null

if ($Mode -eq "signtool") {
  $signTool = Get-SignToolPath
}

if ($Mode -eq "trusted-signing") {
  $trustedSigningCli = Get-TrustedSigningCliPath
}

if ($Mode -eq "signtool") {
  if (-not $CertificatePath) {
    $CertificatePath = $env:CONDATOOL_SIGN_CERT_PATH
  }

  if (-not $CertificatePassword) {
    $CertificatePassword = $env:CONDATOOL_SIGN_CERT_PASSWORD
  }

  if (-not $CertificatePath) {
    throw "CertificatePath is required. Pass -CertificatePath or set CONDATOOL_SIGN_CERT_PATH."
  }

  if (!(Test-Path $CertificatePath)) {
    throw "Certificate file not found: $CertificatePath"
  }
}

if ($Mode -eq "trusted-signing") {
  if (-not $TrustedSigningEndpoint) {
    $TrustedSigningEndpoint = $env:CONDATOOL_TRUSTED_SIGNING_ENDPOINT
  }
  if (-not $TrustedSigningAccount) {
    $TrustedSigningAccount = $env:CONDATOOL_TRUSTED_SIGNING_ACCOUNT
  }
  if (-not $TrustedSigningCertificateProfile) {
    $TrustedSigningCertificateProfile = $env:CONDATOOL_TRUSTED_SIGNING_PROFILE
  }

  if (-not $TrustedSigningEndpoint -or -not $TrustedSigningAccount -or -not $TrustedSigningCertificateProfile) {
    throw "Trusted Signing mode requires endpoint, account, and certificate profile."
  }
}

$targetFiles = @()
if ($Files -and $Files.Count -gt 0) {
  $targetFiles = $Files
} else {
  $targetFiles = Get-DefaultFiles -ProjectRoot $projectRoot -IncludeRuntime (-not $SkipRuntime) -IncludeBundles (-not $SkipBundles)
}

$existingTargets = @()
foreach ($file in $targetFiles) {
  if (Test-Path $file) {
    $existingTargets += (Resolve-Path $file).Path
  } else {
    Write-Warning "Skip missing file: $file"
  }
}

if ($existingTargets.Count -eq 0) {
  throw "No files available for signing."
}

foreach ($file in $existingTargets) {
  Write-Host "Signing: $file" -ForegroundColor Cyan
  if ($Mode -eq "signtool") {
    $arguments = @(
      "sign",
      "/fd", "SHA256",
      "/tr", $TimestampUrl,
      "/td", "SHA256",
      "/f", $CertificatePath
    )

    if ($CertificatePassword) {
      $arguments += @("/p", $CertificatePassword)
    }

    $arguments += $file

    & $signTool @arguments
    if ($LASTEXITCODE -ne 0) {
      throw "signtool failed for: $file"
    }
  }

  if ($Mode -eq "trusted-signing") {
    $arguments = @(
      "-e", $TrustedSigningEndpoint,
      "-a", $TrustedSigningAccount,
      "-c", $TrustedSigningCertificateProfile,
      "-d", $TrustedSigningDescription,
      $file
    )

    & $trustedSigningCli @arguments
    if ($LASTEXITCODE -ne 0) {
      throw "trusted-signing-cli failed for: $file"
    }
  }
}

Write-Host "All requested files have been signed." -ForegroundColor Green
