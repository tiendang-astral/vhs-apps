#!/bin/sh
# Build và chạy vhs-task trên máy này (web :WEB_PORT, API :API_PORT trong .env). Tắt: ./scripts/down.sh
set -e
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Thiếu .env — chạy: cp .env.example .env rồi điền DB_CONNECTION, JWT_SECRET"; exit 1; }

docker compose up -d --build
docker compose ps
