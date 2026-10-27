#!/bin/sh
# Nạp archive của backup.sh vào VPS MỚI. Chạy TẠI thư mục gốc repo đã git clone:
#   ./scripts/restore.sh migrate-XXXXXXXX-XXXXXX.tar.gz
# Khôi phục .env + 3 volume. KHÔNG tự chạy app — chạy deploy ở bước cuối.
set -e
cd "$(dirname "$0")/.."
ROOT=$(pwd)

ARCHIVE="$1"
[ -f "$ARCHIVE" ] || { echo "Dùng: ./scripts/restore.sh <migrate-XXXX.tar.gz>"; exit 1; }
ARCHIVE=$(cd "$(dirname "$ARCHIVE")" && pwd)/$(basename "$ARCHIVE")  # tuyệt đối

TMP=$(mktemp -d)
tar xzf "$ARCHIVE" -C "$TMP"
BK=$(find "$TMP" -maxdepth 1 -type d -name 'migrate-*')
[ -d "$BK" ] || { echo "LỖI: archive sai định dạng"; rm -rf "$TMP"; exit 1; }

# 1. Khôi phục .env vào repo
echo ">> Khôi phục .env"
tar xzf "$BK/env.tar.gz" -C "$ROOT"

# 2. Nạp từng volume (tên volume = tên file .tar.gz)
for f in "$BK"/volumes/*.tar.gz; do
  v=$(basename "$f" .tar.gz)
  if docker volume inspect "$v" >/dev/null 2>&1; then
    echo "LỖI: volume '$v' đã tồn tại. Xóa trước nếu chắc chắn:  docker volume rm $v"
    rm -rf "$TMP"; exit 1
  fi
  echo ">> Khôi phục volume: $v"
  docker volume create "$v" >/dev/null
  docker run --rm -v "$v":/dst -v "$BK/volumes":/src:ro alpine \
    tar xzf "/src/$v.tar.gz" -C /dst
done

rm -rf "$TMP"

echo
echo "XONG. .env và volume đã về chỗ. Giờ chạy từng app:"
echo "  ./vhs-task/scripts/deploy.sh"
echo "  (cd vhs-soquy && docker compose up -d --build)"
echo "  (cd vhs-loans && docker compose up -d --build)"
echo "  (cd hub       && docker compose up -d)"
echo
echo "Nhắc: mở allowlist IP VPS mới ở máy SQL Server (103.176.179.125) cho vhs-task."
