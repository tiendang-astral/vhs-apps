#!/bin/sh
# Build và chạy vhs-task trên máy này (web :WEB_PORT, API :API_PORT trong env/vhs-task/.env). Tắt: ./scripts/down.sh
set -e
cd "$(dirname "$0")/.."
E=../env/vhs-task/.env
[ -f $E ] || { echo "Thiếu env/vhs-task/.env — chạy: cp .env.example $E rồi điền DB_CONNECTION, JWT_SECRET"; exit 1; }

docker compose --env-file $E up -d --build
docker compose --env-file $E ps
