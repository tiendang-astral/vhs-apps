#!/bin/sh
# Chạy môi trường dev trên máy này: mỗi app dùng env/<app>/.env.dev. Tắt hết: ./scripts/down.sh
set -e
cd "$(dirname "$0")/.."
# Chạy trong vhs-app → hiện nút nổi về hub (dùng riêng src Timori thì mặc định ẩn)
export SHOW_HUB_BUTTON=true
# Mạng Docker chung để Quản trị tài chính ↔ Kế toán gọi nhau (http://qttc:8000, http://ketoan:8770)
docker network inspect timori >/dev/null 2>&1 || docker network create timori

for d in Timori-Quan-tri-tai-chinh Timori-ke-toan-app vhs-task hub; do
  echo "== $d"
  E="../env/$d/.env.dev"
  [ -f "env/$d/.env.dev" ] || { echo "Thiếu env/$d/.env.dev"; exit 1; }
  # --force-recreate cho hub để sinh lại apps.txt từ .env.dev
  (cd "$d" && ENV_FILE="$E" docker compose --env-file "$E" up -d --build $([ "$d" = hub ] && echo --force-recreate))
done
# Chỉ hiện container chạy từ các thư mục của project này
docker ps --format '{{.Label "com.docker.compose.project.working_dir"}}\t{{.Names}}\t{{.Ports}}\t{{.Status}}' \
  | grep "^$PWD/" | cut -f2- || echo "(không có container nào đang chạy)"
