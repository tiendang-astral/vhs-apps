#!/bin/sh
# Chạy môi trường dev trên máy này: mỗi thư mục dùng .env.dev của nó. Tắt hết: ./scripts/down.sh
set -e
cd "$(dirname "$0")/.."
export ENV_FILE=.env.dev

for d in vhs-soquy vhs-loans hub; do
  echo "== $d"
  [ -f "$d/$ENV_FILE" ] || { echo "Thiếu $d/$ENV_FILE"; exit 1; }
  # --force-recreate cho hub để sinh lại apps.txt từ .env.dev
  (cd "$d" && docker compose --env-file "$ENV_FILE" up -d --build $([ "$d" = hub ] && echo --force-recreate))
done
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
