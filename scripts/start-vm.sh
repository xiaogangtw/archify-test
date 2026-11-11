#!/bin/sh
set -eu
case "${1:-}" in
  '') skip_build=0 ;;
  --skip-build) skip_build=1 ;;
  *) printf '%s\n' 'Usage: start-vm.sh [--skip-build]' >&2; exit 2 ;;
esac
cd "$(dirname "$0")/.."
umask 077
mkdir -p .local/integration-secrets
if [ ! -f config/api-environments.json ]; then
  cp config/api-environments.example.json config/api-environments.json
fi
for name in db-password worker-token android-worker-token; do
  if [ ! -f ".local/$name" ]; then
    head -c 32 /dev/urandom | base64 > ".local/$name"
  fi
done
chmod 700 .local .local/integration-secrets
chmod 600 .local/db-password .local/worker-token .local/android-worker-token
# Match the private token owner and grant only the socket's existing group access.
# Persist these non-secret IDs so later compose commands use the same identity.
ARCHIFY_UID=$(stat -c '%u' .local/worker-token)
ARCHIFY_GID=$(stat -c '%g' .local/worker-token)
ARCHIFY_DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
export ARCHIFY_UID ARCHIFY_GID ARCHIFY_DOCKER_GID
touch .env
sed '/^ARCHIFY_UID=/d; /^ARCHIFY_GID=/d; /^ARCHIFY_DOCKER_GID=/d' .env > .local/compose-env.tmp
printf 'ARCHIFY_UID=%s\nARCHIFY_GID=%s\nARCHIFY_DOCKER_GID=%s\n' "$ARCHIFY_UID" "$ARCHIFY_GID" "$ARCHIFY_DOCKER_GID" >> .local/compose-env.tmp
mv .local/compose-env.tmp .env
chmod 600 .env
if [ "$skip_build" = 0 ]; then
  # Keep build jobs sequential on small execution VMs; Docker still reuses its cache.
  for service in control-api launcher runner-image; do
    printf '\n[build] %s\n' "$service"
    docker compose --progress plain --profile build build "$service"
  done
fi
printf '\n[start] Starting services and checking readiness (150 second limit).\n'
if ! docker compose up -d --wait --wait-timeout 150 postgres control-api launcher; then
  docker compose ps -a
  docker compose logs --tail 80 control-api
  printf '%s\n' 'Startup did not confirm readiness. Run npm run vm:diagnose. To retry startup without rebuilding: npm run android:pair -- -Resume'
  exit 1
fi
printf '%s\n' 'Control API: http://127.0.0.1:3001/api/health (VM loopback). Use an SSH tunnel from Windows.'
