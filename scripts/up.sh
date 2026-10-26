#!/bin/sh
# Chạy môi trường dev trên máy này: mỗi thư mục dùng .env.dev của nó. Tắt hết: ./scripts/down.sh
set -e
cd "$(dirname "$0")/.."
export ENV_FILE=.env.dev

for d in vhs-soquy vhs-loans vhs-task hub; do
  echo "== $d"
  [ -f "$d/$ENV_FILE" ] || { echo "Thiếu $d/$ENV_FILE"; exit 1; }
  # --force-recreate cho hub để sinh lại apps.txt từ .env.dev
  (cd "$d" && docker compose --env-file "$ENV_FILE" up -d --build $([ "$d" = hub ] && echo --force-recreate))
done
# Chỉ hiện container chạy từ các thư mục của project này
docker ps --format '{{.Label "com.docker.compose.project.working_dir"}}\t{{.Names}}\t{{.Ports}}\t{{.Status}}' \
  | grep "^$PWD/" | cut -f2- || echo "(không có container nào đang chạy)"
