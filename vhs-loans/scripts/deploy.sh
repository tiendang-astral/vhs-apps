#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Thiếu file .env"; exit 1; }
docker compose --env-file .env up -d --build
docker compose ps
