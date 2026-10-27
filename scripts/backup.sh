#!/bin/sh
# Sao lưu 3 volume + 4 file .env thành 1 archive để chuyển VPS.
# Chạy tại thư mục gốc repo trên VPS CŨ:  ./scripts/backup.sh
# Script DỪNG stack trước khi nén (để snapshot nhất quán, nhất là Postgres)
# rồi KHỞI ĐỘNG LẠI, nên VPS cũ vẫn phục vụ tiếp sau khi backup.
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)

# Tên volume thật trên Docker (project name = tên thư mục). Đổi nếu khác.
VOLUMES="vhs-task_uploads so_quy_app_pgdata vhs-loans-data"
# Stack có state — dừng để nén nhất quán. hub không có state nên bỏ qua.
STACKS="vhs-task vhs-soquy vhs-loans"
# File .env (bí mật, không nằm trong git) — giữ nguyên đường dẫn tương đối.
ENVS="vhs-task/.env vhs-soquy/.env vhs-loans/.env hub/.env"

STAMP=$(date +%Y%m%d-%H%M%S)
OUT="migrate-$STAMP"
mkdir -p "$OUT/volumes"

# 1. Kiểm tra mọi thứ tồn tại TRƯỚC khi đụng vào gì
for v in $VOLUMES; do
  docker volume inspect "$v" >/dev/null 2>&1 \
    || { echo "LỖI: không thấy volume '$v'. Xem 'docker volume ls' rồi sửa biến VOLUMES."; exit 1; }
done
for e in $ENVS; do
  [ -f "$e" ] || { echo "LỖI: thiếu $e"; exit 1; }
done

# 2. Dừng stack để dữ liệu nhất quán
echo ">> Dừng stack..."
for s in $STACKS; do docker compose -f "$s/docker-compose.yml" stop; done

# 3. Nén từng volume qua container alpine tạm
for v in $VOLUMES; do
  echo ">> Backup volume: $v"
  docker run --rm -v "$v":/src:ro -v "$ROOT/$OUT/volumes":/dst alpine \
    tar czf "/dst/$v.tar.gz" -C /src .
done

# 4. Khởi động lại stack — VPS cũ chạy tiếp tới khi đổi DNS
echo ">> Khởi động lại stack..."
for s in $STACKS; do docker compose -f "$s/docker-compose.yml" up -d; done

# 5. Gói .env
echo ">> Gói .env"
tar czf "$OUT/env.tar.gz" $ENVS

# 6. Gộp thành 1 file
tar czf "$OUT.tar.gz" "$OUT"
rm -rf "$OUT"

echo
echo "XONG -> $ROOT/$OUT.tar.gz"
echo "Chuyển sang VPS mới:"
echo "  scp $OUT.tar.gz user@VPS_MOI:/duong-dan/toi/repo/"
