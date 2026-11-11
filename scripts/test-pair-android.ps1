$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path $PSScriptRoot -Parent
$fixtureRoot = Join-Path $sourceRoot ('.local/pair-test-' + [Guid]::NewGuid().ToString('N'))
$fixtureScripts = Join-Path $fixtureRoot 'scripts'
New-Item -ItemType Directory -Force -Path $fixtureScripts | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'pair-android.ps1') -Destination $fixtureScripts
$fixtureScript = Join-Path $fixtureScripts 'pair-android.ps1'
$fixtureToken = Join-Path $fixtureRoot '.local/android-worker-token'
$global:pairTestMode = 'success'
$global:pairTestCalls = 0
function global:ssh {
    $global:pairTestCalls++
    $command = [string]$args[-1]
    if ($command -match 'printf %s ([A-Za-z0-9+/=]+)') { $command = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Matches[1])) }
    if ($command -notmatch 'ARCHIFY_PAIR_[a-f0-9]+:') { throw 'Missing private response marker.' }
    $marker = $Matches[0]
    $global:LASTEXITCODE = 0
    if ($global:pairTestMode -eq 'failed') { $global:LASTEXITCODE = 1; return }
    if ($global:pairTestMode -eq 'invalid') { return ($marker + 'invalid') }
    'Remote stage completed.'
    $marker + ('a' * 43 + '=')
    if ($global:pairTestMode -eq 'late-failure') { $global:LASTEXITCODE = 1 }
}
function global:scp { $global:LASTEXITCODE = 0 }
function global:tar { $global:LASTEXITCODE = 0 }
try {
    $output = & $fixtureScript -DownloadOnly 6>&1 | Out-String
    $saved = [IO.File]::ReadAllText($fixtureToken)
    if ($saved.Trim().Length -ne 44) { throw 'Successful download was not saved.' }
    if ($output.Contains(('a' * 43 + '=')) -or $output.Contains('ARCHIFY_PAIR_')) { throw 'Pairing leaked to console output.' }
    foreach ($mode in @('failed', 'invalid', 'late-failure')) {
        $global:pairTestMode = $mode
        $rejected = $false
        try { & $fixtureScript -DownloadOnly } catch { $rejected = $true }
        if (-not $rejected) { throw "Expected rejection: $mode" }
        if ([IO.File]::ReadAllText($fixtureToken) -ne $saved) { throw 'Existing pairing changed on failure.' }
    }
    $global:pairTestMode = 'success'
    foreach ($mode in @('resume', 'deploy')) {
        $global:pairTestCalls = 0
        if ($mode -eq 'resume') { $output = & $fixtureScript -Resume 6>&1 | Out-String }
        else { $output = & $fixtureScript 6>&1 | Out-String }
        if ($global:pairTestCalls -ne 1) { throw 'Deployment must retrieve pairing over its existing SSH connection.' }
        if ($output.Contains(('a' * 43 + '=')) -or $output.Contains('ARCHIFY_PAIR_')) { throw 'Pairing leaked to console output.' }
        if ([IO.File]::ReadAllText($fixtureToken) -ne $saved) { throw 'Pairing response was not saved correctly.' }
    }
    Write-Host 'PASS download-only, single-SSH deploy/resume, hidden token, SSH/invalid/late failure preservation. Mock SSH only.'
} finally {
    Set-Location -LiteralPath $sourceRoot
    Remove-Item Function:\ssh
    Remove-Item Function:\scp
    Remove-Item Function:\tar
}
