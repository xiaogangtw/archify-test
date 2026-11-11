param([string]$VmTarget='vmuser@127.0.0.1',[int]$Port=2222)
$ErrorActionPreference='Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
  New-Item -ItemType Directory -Path work -Force | Out-Null
  $archive='work/api-library-update.tar.gz'
  & tar --exclude=node_modules --exclude=.env --exclude=.local -czf $archive package.json package-lock.json services/control-api services/runner/smoke.spec.ts config/api-environments.example.json scripts/install-api-library.sh scripts/start-vm.sh API-REQUEST-LIBRARY.md
  if($LASTEXITCODE -ne 0){throw '建立更新檔失敗。'}
  & scp -P $Port $archive "${VmTarget}:~/archify-test/"
  if($LASTEXITCODE -ne 0){throw '傳送更新檔失敗。'}
  & ssh -t -p $Port $VmTarget 'cd ~/archify-test && tar -xzf api-library-update.tar.gz && sh scripts/install-api-library.sh'
  if($LASTEXITCODE -ne 0){throw 'VM 更新未完成，請查看上方訊息。'}
} finally { Pop-Location }
