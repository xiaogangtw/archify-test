param(
    [Parameter(Mandatory=$true)][string]$SdkRoot,
    [ValidateSet('list','stop')][string]$Action = 'list',
    [int]$TargetId = 0,
    [string]$CreatedAt = '',
    [string]$Avd = '',
    [int]$Port = 0
)
$ErrorActionPreference = 'Stop'
$emulatorRoot = [IO.Path]::GetFullPath((Join-Path $SdkRoot 'emulator'))
$allowed = @(
    (Join-Path $emulatorRoot 'emulator.exe'),
    (Join-Path $emulatorRoot 'qemu/windows-x86_64/qemu-system-x86_64.exe'),
    (Join-Path $emulatorRoot 'qemu/windows-x86_64/qemu-system-x86_64-headless.exe')
)
function Read-Identity($process) {
    if (-not $process -or $allowed -notcontains $process.ExecutablePath) { return }
    $nameMatch = [regex]::Match($process.CommandLine, '(?:^|\s)-avd\s+"?([A-Za-z0-9_.-]+)"?(?=\s|$)')
    $portMatch = [regex]::Match($process.CommandLine, '(?:^|\s)-port\s+"?(\d+)"?(?=\s|$)')
    if (-not $nameMatch.Success -or -not $portMatch.Success) { return }
    $number = [int]$portMatch.Groups[1].Value
    if ($number -lt 5554 -or $number -gt 5584 -or $number % 2 -ne 0) { return }
    [pscustomobject]@{ pid = [int]$process.ProcessId; launcher = $process.Name -eq 'emulator.exe'; createdAt = $process.CreationDate.ToUniversalTime().ToString('o'); avd = $nameMatch.Groups[1].Value; serial = "emulator-$number" }
}
if ($Action -eq 'list') {
    $rows = @(Get-CimInstance Win32_Process -Filter "Name='emulator.exe' OR Name='qemu-system-x86_64.exe' OR Name='qemu-system-x86_64-headless.exe'" | ForEach-Object { Read-Identity $_ })
    ConvertTo-Json -InputObject $rows -Compress
} else {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$TargetId"
    if (-not $process) { exit 0 }
    $identity = Read-Identity $process
    if (-not $identity -or $identity.createdAt -cne $CreatedAt -or $identity.avd -cne $Avd -or $identity.serial -cne "emulator-$Port") {
        throw 'Process identity changed; no process was stopped.'
    }
    Stop-Process -Id $TargetId -Force -ErrorAction Stop
}
