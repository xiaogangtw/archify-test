param([switch]$BuildOnly)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force .local/integration-secrets | Out-Null
foreach ($name in @('db-password','worker-token')) {
  $target = Join-Path '.local' $name
  if (-not (Test-Path -LiteralPath $target)) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $target), [Convert]::ToBase64String($bytes))
  }
}
# Restrict local credentials to the current Windows account.
$account = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls '.local' /inheritance:r /grant:r "${account}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Unable to secure local credential directory' }
& docker compose --profile build build
if ($LASTEXITCODE -ne 0) { throw 'Docker build failed. Start Docker Desktop in Linux container mode.' }
if (-not $BuildOnly) {
  & docker compose up -d postgres control-api
  if ($LASTEXITCODE -ne 0) { throw 'Services did not start' }
  Write-Host 'Next: npm run launcher (keep this terminal open); then start apps/web.'
}
