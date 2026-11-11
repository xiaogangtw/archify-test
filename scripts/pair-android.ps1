param([switch]$DownloadOnly, [switch]$Resume)
$ErrorActionPreference = 'Stop'
if ($DownloadOnly -and $Resume) { throw 'Choose either -DownloadOnly or -Resume.' }
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectRoot
$batchId = [Guid]::NewGuid().ToString('N')
$pairingMarker = "ARCHIFY_PAIR_${batchId}:"
$pairing = @{ Token = $null }
# Consume the private response before writing any remote output to the terminal.
function Receive-PairingOutput {
  process {
    $line = [string]$_
    if ($line.StartsWith($pairingMarker)) { $pairing.Token = $line.Substring($pairingMarker.Length).Trim() }
    else { Write-Host $line }
  }
}
$readPairing = "test -s .local/android-worker-token; printf '\n%s' '$pairingMarker'; cat .local/android-worker-token"
$vmTarget = if ($env:ARCHIFY_VM_TARGET) { $env:ARCHIFY_VM_TARGET } else { 'vmuser@127.0.0.1' }
if ($Resume) {
Write-Host '[resume] Starting the existing VM images without uploading or rebuilding. Enter your Ubuntu password when prompted.'
& ssh -t -p 2222 -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=6 $vmTarget "set -eu; cd ~/archify-test; sh scripts/start-vm.sh --skip-build; $readPairing" | Receive-PairingOutput
if ($LASTEXITCODE -ne 0) { throw 'Readiness not confirmed. Run npm run vm:diagnose; do not rebuild repeatedly.' }
} elseif (-not $DownloadOnly) {
$archiveName = "android-update-$batchId.tar.gz"
$archivePath = Join-Path $projectRoot ".local/$archiveName"
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot '.local') | Out-Null

Write-Host '[1/4] Preparing source update. Database, VM secrets and SDK are excluded.'
& tar --exclude=node_modules --exclude=dist --exclude=.local --exclude=.git --exclude=.npm-cache --exclude=*.tsbuildinfo --exclude=.env --exclude=.env.* --exclude=*.pem --exclude=*.key --exclude=*.p12 -czf $archivePath compose.yaml package.json package-lock.json .dockerignore services apps/web scripts/start-vm.sh deploy config/integrations.empty.json config/api-environments.example.json
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the source update.' }

Write-Host '[2/4] Uploading to the existing Ubuntu VM. Enter your Ubuntu password when prompted.'
& scp -P 2222 -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=6 $archivePath "${vmTarget}:/tmp/$archiveName"
if ($LASTEXITCODE -ne 0) { throw 'Upload failed. No VM update was started.' }

Write-Host '[3/4] Backing up source, building images sequentially, then checking service readiness. Build steps will be printed below.'
$remoteCommand = "set -eu; cd ~/archify-test; umask 077; mkdir -p .local; tar --exclude=node_modules --exclude=dist --exclude=.local --exclude=.git -czf .local/android-before-$batchId.tar.gz compose.yaml package.json package-lock.json services scripts/start-vm.sh deploy; if test -d apps; then tar --exclude=node_modules --exclude=dist --exclude=*.tsbuildinfo -czf .local/android-web-before-$batchId.tar.gz apps; fi; shared_web=`$(docker compose --profile share ps -q web); tar -xzf /tmp/$archiveName; tr -d '\015' < scripts/start-vm.sh > .local/android-start.sh; cat .local/android-start.sh > scripts/start-vm.sh; sh scripts/start-vm.sh; if test -n `"`$shared_web`"; then docker compose --profile share up -d --build --no-deps web; fi; test -s .local/android-worker-token"
$remoteCommand += "; $readPairing"
$remoteEncoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteCommand))
& ssh -t -p 2222 -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=6 $vmTarget "printf %s $remoteEncoded | base64 -d | sh" | Receive-PairingOutput
if ($LASTEXITCODE -ne 0) { throw 'VM update did not finish. If builds completed but startup timed out, run npm run vm:diagnose, then npm run android:pair -- -Resume. If already healthy, use -DownloadOnly.' }
}

# Download to a temporary file first; never replace an existing pairing on transfer failure.
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot '.local') | Out-Null
$temporaryToken = Join-Path $projectRoot ".local/android-worker-token-$batchId.tmp"
if ($DownloadOnly) {
  Write-Host '[4/4] Retrieving pairing file only. Enter your Ubuntu password when prompted. The file content will not be printed.'
  & ssh -t -p 2222 -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=6 $vmTarget "set -eu; cd ~/archify-test; $readPairing" | Receive-PairingOutput
  if ($LASTEXITCODE -ne 0) { throw 'Pairing download failed. Retry npm run android:pair -- -DownloadOnly; no rebuild is needed.' }
} else { Write-Host '[4/4] Saving pairing received through the existing deployment connection.' }
$tokenText = [string]$pairing.Token
if ($tokenText -notmatch '^[A-Za-z0-9+/=_-]{32,256}$') { throw 'Pairing file was invalid; existing pairing was not replaced.' }
[IO.File]::WriteAllText($temporaryToken, $tokenText + "`n", [Text.UTF8Encoding]::new($false))
[IO.File]::Copy($temporaryToken, (Join-Path $projectRoot '.local/android-worker-token'), $true)
Remove-Item -LiteralPath $temporaryToken
if ($DownloadOnly) { Write-Host 'Pairing file retrieved. VM images were not rebuilt. Run npm run dev.' }
else { Write-Host 'VM update and pairing finished. Restart npm run dev to load the new Windows worker and web interface.' }
