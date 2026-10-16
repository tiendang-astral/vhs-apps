#!/bin/sh
# Chạy hub + các app trên máy này. Tắt hết: ./scripts/down.sh
# Mỗi thư mục dùng trực tiếp .env của nó: hub/.env, vhs-soquy/.env, vhs-loans/.env.
set -e
cd "$(dirname "$0")/.."

for d in vhs-soquy vhs-loans hub; do
  echo "== $d"
  if [ "$1" = down ]; then
    (cd "$d" && docker compose down)
    continue
  fi

  [ -f "$d/.env" ] || { echo "Thiếu $d/.env"; exit 1; }

  # --force-recreate cho hub để sinh lại apps.txt từ .env
  (cd "$d" && docker compose up -d --build $([ "$d" = hub ] && echo --force-recreate))
done
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
