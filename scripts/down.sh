#!/bin/sh
# Tắt hub + 2 app trên máy này. Dữ liệu giữ nguyên:
#   vhs-loans → vhs-loans/data/loans.db (bind mount trên host)
#   vhs-soquy → volume pgdata (docker compose down KHÔNG xoá volume)
# Muốn xoá luôn cả dữ liệu: docker compose down -v trong từng thư mục app.
set -e
cd "$(dirname "$0")/.."

for d in vhs-soquy vhs-loans hub; do
  echo "== Tắt $d"
  (cd "$d" && docker compose down)
done
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
