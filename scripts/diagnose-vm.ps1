$ErrorActionPreference = 'Stop'
$diagnostic = @'
cd ~/archify-test || exit 1
printf '\n%s\n' '--- VM uptime and resources ---'
uptime
free -h
df -h /
printf '\n%s\n' '--- Container status ---'
docker compose ps -a
container_id=$(docker compose ps -aq control-api)
if [ -z "$container_id" ]; then
  printf '%s\n' 'No control-api container exists.'
  exit 1
fi
printf '\n%s\n' '--- Actual health check command ---'
docker inspect --format '{{json .Config.Healthcheck.Test}}' "$container_id"
printf '\n%s\n' '--- Health result history (exit codes and output) ---'
docker inspect --format '{{json .State.Health}}' "$container_id"
printf '\n%s\n' '--- Container resource usage ---'
timeout 20s docker stats --no-stream --format '{{.Name}} CPU={{.CPUPerc}} Memory={{.MemUsage}} PIDs={{.PIDs}}' "$container_id" || true
printf '\n%s\n' '--- VM host API response ---'
curl -sS --max-time 8 http://127.0.0.1:3001/api/health || true
printf '\n%s\n' '--- Recent API log ---'
docker compose logs --tail 40 control-api
'@
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($diagnostic.Replace("`r`n", "`n")))
Write-Host 'Read-only VM diagnosis. Enter the Ubuntu password when prompted. No build, restart or data change will be performed.'
$vmTarget = if ($env:ARCHIFY_VM_TARGET) { $env:ARCHIFY_VM_TARGET } else { 'vmuser@127.0.0.1' }
& ssh -t -p 2222 -o ConnectTimeout=10 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 $vmTarget "printf %s $encoded | base64 -d | sh"
if ($LASTEXITCODE -ne 0) { throw 'VM diagnosis did not complete. Keep the output above for troubleshooting.' }
