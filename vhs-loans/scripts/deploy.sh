#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
E=../env/vhs-loans/.env
[ -f $E ] || { echo "Thiếu file env/vhs-loans/.env"; exit 1; }
docker compose --env-file $E up -d --build
docker compose --env-file $E ps
