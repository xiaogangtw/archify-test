$ErrorActionPreference = 'Stop'
$script:stopped = $false
$sdk = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.local/android-sdk'))
$created = [datetime]'2026-10-30T00:00:00Z'
$script:row = [pscustomobject]@{
    ProcessId = 123; Name = 'emulator.exe'; ExecutablePath = (Join-Path $sdk 'emulator/emulator.exe')
    CreationDate = $created; CommandLine = 'emulator.exe -avd Archify_Test -port 5554'
}
# These mocks shadow the OS operations; this test never stops a real process.
function Get-CimInstance { param($ClassName, $Filter) return $script:row }
function Stop-Process { param($Id, [switch]$Force, $ErrorAction) $script:stopped = $true }
$runner = Join-Path $PSScriptRoot 'android-host-process.ps1'
$stamp = $created.ToUniversalTime().ToString('o')
. $runner -SdkRoot $sdk -Action stop -TargetId 123 -CreatedAt $stamp -Avd Archify_Test -Port 5554
if (-not $script:stopped) { throw 'Verified identity did not stop.' }
foreach ($mutation in @('timestamp','path','avd','port')) {
    $script:stopped = $false
    $script:row.ExecutablePath = Join-Path $sdk 'emulator/emulator.exe'
    $script:row.CommandLine = 'emulator.exe -avd Archify_Test -port 5554'
    $script:row.CreationDate = $created
    switch ($mutation) {
        'timestamp' { $script:row.CreationDate = $created.AddSeconds(1) }
        'path' { $script:row.ExecutablePath = 'C:\other\emulator.exe' }
        'avd' { $script:row.CommandLine = 'emulator.exe -avd Other -port 5554' }
        'port' { $script:row.CommandLine = 'emulator.exe -avd Archify_Test -port 5556' }
    }
    $rejected = $false
    try { . $runner -SdkRoot $sdk -Action stop -TargetId 123 -CreatedAt $stamp -Avd Archify_Test -Port 5554 } catch { $rejected = $true }
    if (-not $rejected -or $script:stopped) { throw "Unsafe identity accepted: $mutation" }
}
Write-Output 'Host identity guards passed.'
