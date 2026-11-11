#!/bin/sh
# Tắt hub + các app trên máy này. Dữ liệu giữ nguyên:
#   Timori-Quan-tri-tai-chinh → volume timori_qttc_pgdata, Timori-ke-toan-app → timori_ketoan_data (down KHÔNG xoá volume)
#   vhs-task  → volume uploads (file upload); DB là SQL Server bên ngoài
# Muốn xoá luôn cả dữ liệu: docker compose down -v trong từng thư mục app.
set -e
cd "$(dirname "$0")/.."

for d in Timori-Quan-tri-tai-chinh Timori-ke-toan-app vhs-task hub; do
  echo "== Tắt $d"
  (cd "$d" && docker compose --env-file "../env/$d/.env" down)
done
# Chỉ hiện container chạy từ các thư mục của project này
docker ps --format '{{.Label "com.docker.compose.project.working_dir"}}\t{{.Names}}\t{{.Ports}}\t{{.Status}}' \
  | grep "^$PWD/" | cut -f2- || echo "(không có container nào đang chạy)"
