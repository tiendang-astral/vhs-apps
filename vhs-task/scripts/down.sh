#!/bin/sh
# Tắt vhs-task trên máy này. File upload (volume uploads) vẫn giữ nguyên.
set -e
cd "$(dirname "$0")/.."

docker compose down
