#!/bin/sh
# Gửi hub lên VPS và khởi động lại. Đổi đích: HOST=root@x.x.x.x DIR=/root/abc ./scripts/deploy.sh
set -e
HOST=${HOST:-root@45.117.169.133}
DIR=${DIR:-/root/vhs-hub}
cd "$(dirname "$0")/.."

ssh "$HOST" "mkdir -p $DIR"
scp index.html docker-compose.yml .env "$HOST:$DIR/"
# --force-recreate để luôn sinh lại apps.txt từ .env
ssh "$HOST" "cd $DIR && docker compose up -d --force-recreate && docker compose ps"
