#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
active=$(docker compose exec -T postgres psql -U archify -d archify -Atc "SELECT (SELECT count(*) FROM api_analysis_jobs WHERE status IN ('queued','running')) + (SELECT count(*) FROM runs WHERE status IN ('queued','running'));")
workflow_table=$(docker compose exec -T postgres psql -U archify -d archify -Atc "SELECT to_regclass('public.api_workflow_jobs');")
if [ -n "$workflow_table" ]; then
  workflow_active=$(docker compose exec -T postgres psql -U archify -d archify -Atc "SELECT count(*) FROM api_workflow_jobs WHERE status IN ('queued','running');")
  active=$((active + workflow_active))
fi
if [ "$active" != "0" ]; then
  printf '%s\n' '仍有進行中的整理或測試工作。請等待工作完成後，重新執行更新。'
  exit 1
fi
umask 077
if [ ! -f config/api-environments.json ]; then
  cp config/api-environments.example.json config/api-environments.json
fi
docker compose build control-api
docker compose up -d --no-deps control-api
docker compose ps control-api
printf '%s\n' 'API 後端已更新。請回網頁重新整理；原有專案、案例與執行資料保留。'
