#!/bin/sh
# Tắt hub + các app trên máy này. Dữ liệu giữ nguyên:
#   vhs-loans → volume vhs-loans-data (tên cố định, không phụ thuộc thư mục)
#   vhs-soquy → volume pgdata (docker compose down KHÔNG xoá volume)
#   vhs-task  → volume uploads (file upload); DB là SQL Server bên ngoài
# Muốn xoá luôn cả dữ liệu: docker compose down -v trong từng thư mục app.
set -e
cd "$(dirname "$0")/.."

for d in vhs-soquy vhs-loans vhs-task hub; do
  echo "== Tắt $d"
  (cd "$d" && docker compose down)
done
# Chỉ hiện container chạy từ các thư mục của project này
docker ps --format '{{.Label "com.docker.compose.project.working_dir"}}\t{{.Names}}\t{{.Ports}}\t{{.Status}}' \
  | grep "^$PWD/" | cut -f2- || echo "(không có container nào đang chạy)"
