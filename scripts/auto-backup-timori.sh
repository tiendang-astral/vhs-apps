#!/usr/bin/env bash
# Sao lưu 2 phần mềm TIMORI chạy trong vhs-app (dựa trên Timori-Quan-tri-tai-chinh/trien-khai/sao-luu.sh + chung.sh,
# không sửa repo Timori). Chạy tay: ./scripts/auto-backup-timori.sh — hoặc cron mỗi đêm:
#   echo '0 1 * * * root /root/apps/vhs-apps/scripts/auto-backup-timori.sh >> /var/log/timori-sao-luu.log 2>&1' > /etc/cron.d/timori-sao-luu
# App vẫn chạy trong lúc sao lưu. KHÔNG kèm env/ (khoá). Cấu hình (sửa trong /etc/timori.conf hoặc biến môi trường):
#   BACKUP_DIR        nơi để bản sao lưu trên máy chủ   (mặc định <thư mục cha của repo>/sao-luu, nằm ngoài repo)
#   KEEP_DAYS         giữ bao nhiêu ngày                (mặc định 30)
#   RCLONE_REMOTE     chép ra ngoài, vd gdrive:TIMORI-sao-luu (trống = chỉ lưu trên máy chủ)
#   BACKUP_PASS_FILE  tệp mật khẩu mã hoá GPG           (trống = không mã hoá)
set -euo pipefail
umask 077
ROOT=$(cd "$(dirname "$0")/.." && pwd)
CONF=${TIMORI_CONF:-/etc/timori.conf}; [ -f "$CONF" ] && . "$CONF"
BACKUP_DIR=${BACKUP_DIR:-$(dirname "$ROOT")/sao-luu}
KEEP_DAYS=${KEEP_DAYS:-30}
RCLONE_REMOTE=${RCLONE_REMOTE:-}
BACKUP_PASS_FILE=${BACKUP_PASS_FILE:-}
QDB=timori_qttc_db; KAPP=timori_ketoan_app; KT_DB=/app/data/ketoan.sqlite

loi() { echo "LỖI: $*" >&2; exit 1; }
bao() { echo "  • $*"; }
for c in $QDB $KAPP; do [ "$(docker inspect -f '{{.State.Running}}' $c 2>/dev/null)" = true ] || loi "Container $c chưa chạy"; done

T=$(date +%Y-%m-%d_%H%M%S); D=$BACKUP_DIR/$T; mkdir -p "$D"
trap 'rc=$?; [ $rc -eq 0 ] || echo "$(date "+%F %T") LỖI – sao lưu $T không thành công (mã $rc)" >> "$BACKUP_DIR/trang-thai.txt"' EXIT
echo "Sao lưu $T → $D"

# 1. Quản trị tài chính (PostgreSQL)
docker exec $QDB pg_dump -U soquy -d soquy -Fc -Z 6 > "$D/qttc.dump"
n=$(docker exec -i $QDB pg_restore -l < "$D/qttc.dump" | grep -c "TABLE DATA" || true)
[ "$n" -ge 20 ] || loi "Bản sao Quản trị tài chính không đọc lại được ($n bảng)"
bao "Quản trị tài chính: $(du -h "$D/qttc.dump" | cut -f1), $n bảng"

# 2. Kế toán (SQLite chụp lúc đang chạy, kiểm tra toàn vẹn)
docker exec $KAPP node --no-warnings -e "
const { DatabaseSync } = require('node:sqlite'); const fs = require('node:fs'); const out = '/app/data/.sao-luu.sqlite';
fs.rmSync(out, { force: true }); new DatabaseSync('$KT_DB').exec(\"VACUUM INTO '\" + out + \"'\");
const r = new DatabaseSync(out, { readOnly: true }).prepare('PRAGMA integrity_check').get();
if (Object.values(r)[0] !== 'ok') { console.error('integrity', r); process.exit(3); }"
docker exec $KAPP cat /app/data/.sao-luu.sqlite | gzip -6 > "$D/ketoan.sqlite.gz"
docker exec $KAPP rm -f /app/data/.sao-luu.sqlite
gzip -t "$D/ketoan.sqlite.gz"
bao "Kế toán: $(du -h "$D/ketoan.sqlite.gz" | cut -f1), đã kiểm tra toàn vẹn"

# 3. Thông tin kèm theo
{ echo "thoi_gian=$T"
  echo "qttc_code=$(git -C "$ROOT/Timori-Quan-tri-tai-chinh" rev-parse --short HEAD 2>/dev/null || echo ?)"
  echo "ketoan_code=$(git -C "$ROOT/Timori-ke-toan-app" rev-parse --short HEAD 2>/dev/null || echo ?)"; } > "$D/thong-tin.txt"
(cd "$D" && sha256sum qttc.dump ketoan.sqlite.gz > sha256.txt)

# 4. Mã hoá (nếu có tệp mật khẩu)
if [ -n "$BACKUP_PASS_FILE" ]; then
  [ -s "$BACKUP_PASS_FILE" ] || loi "Không đọc được BACKUP_PASS_FILE"
  for f in qttc.dump ketoan.sqlite.gz; do
    gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file "$BACKUP_PASS_FILE" --symmetric --cipher-algo AES256 -o "$D/$f.gpg" "$D/$f" && rm -f "$D/$f"
  done
  bao "Đã mã hoá"
fi

# 5. Chép ra ngoài máy chủ
if [ -n "$RCLONE_REMOTE" ]; then
  command -v rclone >/dev/null || loi "Chưa cài rclone"
  rclone copy "$D" "$RCLONE_REMOTE/$T" --quiet
  rclone delete "$RCLONE_REMOTE" --min-age "${KEEP_DAYS}d" --quiet || true
  rclone rmdirs "$RCLONE_REMOTE" --leave-root --quiet || true
  bao "Đã chép ra $RCLONE_REMOTE/$T"
else
  bao "CHÚ Ý: chưa đặt RCLONE_REMOTE – bản sao lưu chỉ nằm trên máy chủ này"
fi

# 6. Dọn bản cũ trên máy chủ
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +"$KEEP_DAYS" -exec rm -rf {} +
echo "$(date "+%F %T") OK – $T – $(du -sh "$D" | cut -f1)${RCLONE_REMOTE:+ – đã chép ra ngoài}" >> "$BACKUP_DIR/trang-thai.txt"
echo "Xong."
