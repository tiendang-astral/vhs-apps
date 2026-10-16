#!/bin/sh
# Tắt hub trên VPS (giữ nguyên file). Đổi đích: HOST=root@x.x.x.x DIR=/root/abc ./scripts/down.sh
set -e
HOST=${HOST:-root@45.117.169.133}
DIR=${DIR:-/root/vhs-hub}

ssh "$HOST" "cd $DIR && docker compose down"
