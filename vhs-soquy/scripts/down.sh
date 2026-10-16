#!/bin/sh
# Tắt sổ quỹ trên máy này (cổng APP_PORT trong .env). Dữ liệu CSDL (volume pgdata) vẫn giữ nguyên.
set -e
cd "$(dirname "$0")/.."

docker compose down
