#!/bin/sh
# Build và chạy sổ quỹ trên máy này. Cổng lấy từ APP_PORT trong .env (mặc định 10080).
set -e
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Thiếu .env — chạy: cp .env.example .env rồi sửa mật khẩu"; exit 1; }

PORT=$(grep '^APP_PORT=' .env | cut -d= -f2)
PORT=${PORT:-10080}

# Dọn sạch trước khi chạy: tắt bản hiện tại, xoá container khác đang chiếm cổng, rồi kill tiến trình còn giữ cổng.
docker compose down
docker ps -q --filter "publish=$PORT" | xargs -r docker rm -f
PIDS=$(lsof -ti "tcp:$PORT" -sTCP:LISTEN || true)
[ -n "$PIDS" ] && { echo "Kill tiến trình giữ cổng $PORT: $PIDS"; kill $PIDS; sleep 1; }

docker compose up -d --build
docker compose ps
echo "Mở: http://localhost:$PORT"
[ "$PORT" = "10080" ] && echo "Lưu ý: trình duyệt chặn cổng 10080 (ERR_UNSAFE_PORT). Chrome: mở bằng cờ --explicitly-allowed-ports=10080; Firefox: about:config → network.security.ports.banned.override = 10080."
exit 0
