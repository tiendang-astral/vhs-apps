#!/bin/sh
# Chạy hub + các app trên máy này. Tắt hết: ./scripts/down.sh
# Mỗi app dùng env/<app>/.env (vd env/hub/.env, env/vhs-soquy/.env).
set -e
cd "$(dirname "$0")/.."

for d in vhs-soquy vhs-task hub; do
  echo "== $d"
  if [ "$1" = down ]; then
    (cd "$d" && docker compose --env-file "../env/$d/.env" down)
    continue
  fi

  [ -f "env/$d/.env" ] || { echo "Thiếu env/$d/.env"; exit 1; }

  # --force-recreate cho hub để sinh lại apps.txt từ .env
  (cd "$d" && ENV_FILE="../env/$d/.env" docker compose --env-file "../env/$d/.env" up -d --build $([ "$d" = hub ] && echo --force-recreate))
done
# Chỉ hiện container chạy từ các thư mục của project này
docker ps --format '{{.Label "com.docker.compose.project.working_dir"}}\t{{.Names}}\t{{.Ports}}\t{{.Status}}' \
  | grep "^$PWD/" | cut -f2- || echo "(không có container nào đang chạy)"
