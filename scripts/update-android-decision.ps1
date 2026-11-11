param([string]$VmTarget = 'vmuser@127.0.0.1', [int]$Port = 2222)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$archiveName = 'android-decision-update.tar.gz'
$archivePath = Join-Path $projectRoot ".local/$archiveName"
# Encode the verification source so Windows native argument handling and the
# remote shell cannot remove its JavaScript string quotes.
$verificationSource = @'
const fs = require("fs");
const c = JSON.parse(fs.readFileSync("services/control-api/src/llmTimeouts.json", "utf8"));
if (c.androidDecisionMs !== 30000) {
  console.error("Unexpected androidDecisionMs:", c.androidDecisionMs);
  process.exit(1);
}
console.log("E2E decision timeout: 30 seconds");
'@
$verificationBase64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($verificationSource))
$remoteCommand = 'set -eu; cd ~/archify-test; umask 077; mkdir -p .local; tar -czf .local/android-before-decision-update.tar.gz services/control-api/src; tar -xzf /tmp/android-decision-update.tar.gz; docker compose build control-api; docker compose up -d --no-deps --wait --wait-timeout 120 control-api; printf %s ' + $verificationBase64 + ' | base64 -d | docker compose exec -T control-api node'
Push-Location $projectRoot
try {
  New-Item -ItemType Directory -Force -Path .local | Out-Null
  & tar -czf $archivePath services/control-api/src/androidDecision.ts services/control-api/src/androidAgentTasks.ts services/control-api/src/main.ts services/control-api/src/integrations.ts services/control-api/src/llmTimeouts.json
  if ($LASTEXITCODE -ne 0) { throw 'Could not prepare update archive.' }
  Write-Host 'Updating E2E decisions to ask after 30 seconds. The backend will restart; current tasks will pause.'
  & scp -P $Port -o ConnectTimeout=10 $archivePath "${VmTarget}:/tmp/$archiveName"
  if ($LASTEXITCODE -ne 0) { throw 'Upload failed. The VM has not been updated.' }
  & ssh -t -p $Port -o ConnectTimeout=10 $VmTarget $remoteCommand
  if ($LASTEXITCODE -ne 0) { throw 'VM update did not finish successfully. Keep the output for diagnosis.' }
  Write-Host 'Update completed. Return to the writing chat and send a new message to continue.'
} finally {
  Pop-Location
}
