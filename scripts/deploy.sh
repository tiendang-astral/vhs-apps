#!/bin/sh
# Chạy hub + các app trên máy này. Tắt hết: ./scripts/down.sh
# Mỗi app dùng env/<app>/.env (vd env/hub/.env, env/Timori-Quan-tri-tai-chinh/.env).
set -e
cd "$(dirname "$0")/.."
# Chạy trong vhs-app → hiện nút nổi về hub (dùng riêng src Timori thì mặc định ẩn)
export SHOW_HUB_BUTTON=true
# Mạng Docker chung để Quản trị tài chính ↔ Kế toán gọi nhau (http://qttc:8000, http://ketoan:8770)
docker network inspect timori >/dev/null 2>&1 || docker network create timori

for d in Timori-Quan-tri-tai-chinh Timori-ke-toan-app vhs-task hub; do
  echo "== $d"
  if [ "$1" = down ]; then
    (cd "$d" && docker compose --env-file "../env/$d/.env" down)
    continue
  fi

  [ -f "env/$d/.env" ] || { echo "Thiếu env/$d/.env"; exit 1; }

  # Quản trị tài chính: lần đầu chép dữ liệu FINANCE cũ (vhs-soquy) sang, đã có dữ liệu thì tự bỏ qua
  [ -x "$d/scripts/migrate-from-soquy.sh" ] && ENV_FILE="../env/$d/.env" "$d/scripts/migrate-from-soquy.sh"

  # --force-recreate cho hub để sinh lại apps.txt từ .env
  (cd "$d" && ENV_FILE="../env/$d/.env" docker compose --env-file "../env/$d/.env" up -d --build $([ "$d" = hub ] && echo --force-recreate))
done
# Chỉ hiện container chạy từ các thư mục của project này
docker ps --format '{{.Label "com.docker.compose.project.working_dir"}}\t{{.Names}}\t{{.Ports}}\t{{.Status}}' \
  | grep "^$PWD/" | cut -f2- || echo "(không có container nào đang chạy)"
