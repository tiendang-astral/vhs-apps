#!/usr/bin/env bash
# Khôi phục / thử khôi phục 2 phần mềm TIMORI trong vhs-app từ bản của auto-backup-timori.sh
# (dựa trên Timori-Quan-tri-tai-chinh/trien-khai/khoi-phuc.sh, gọi thẳng container thay vì docker compose).
#   ./scripts/restore-timori.sh --kiem-tra THƯ_MỤC   Thử khôi phục vào chỗ tạm, không đụng dữ liệu đang chạy (mỗi tháng 1 lần).
#   ./scripts/restore-timori.sh THƯ_MỤC              Khôi phục thật: sao lưu dữ liệu hiện tại trước, rồi thay bằng bản đã chọn.
# THƯ_MỤC: một thư mục trong BACKUP_DIR, vd /root/apps/sao-luu/2026-11-12_010000 (hoặc tải về từ Google Drive).
# Bản đã mã hoá cần BACKUP_PASS_FILE (đọc từ /etc/timori.conf như auto-backup-timori.sh).
set -euo pipefail
umask 077
ROOT=$(cd "$(dirname "$0")/.." && pwd)
CONF=${TIMORI_CONF:-/etc/timori.conf}; [ -f "$CONF" ] && . "$CONF"
BACKUP_DIR=${BACKUP_DIR:-$(dirname "$ROOT")/sao-luu}
BACKUP_PASS_FILE=${BACKUP_PASS_FILE:-}
QDB=timori_qttc_db; QAPP=timori_qttc_app; KAPP=timori_ketoan_app; KVOL=timori_ketoan_data; KT_DB=/app/data/ketoan.sqlite

loi() { echo "LỖI: $*" >&2; exit 1; }
MODE=that; [ "${1:-}" = --kiem-tra ] && { MODE=thu; shift; }
SRC=${1:-}; [ -d "$SRC" ] || loi "Cần thư mục bản sao lưu"; SRC=$(cd "$SRC" && pwd)
for c in $QDB $KAPP; do docker inspect $c >/dev/null 2>&1 || loi "Không thấy container $c – deploy 2 app Timori trước"; done
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

mo() {  # giải mã nếu cần, trả về đường dẫn tệp thường ở chỗ tạm
  local f=$1
  if [ -f "$SRC/$f" ]; then cp "$SRC/$f" "$TMP/$f"
  elif [ -f "$SRC/$f.gpg" ]; then
    [ -s "$BACKUP_PASS_FILE" ] || loi "Bản sao lưu đã mã hoá – cần BACKUP_PASS_FILE"
    gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$BACKUP_PASS_FILE" -d -o "$TMP/$f" "$SRC/$f.gpg"
  else loi "Thiếu $f trong $SRC"; fi
  echo "$TMP/$f"
}
QD=$(mo qttc.dump); KG=$(mo ketoan.sqlite.gz)
if [ -f "$SRC/sha256.txt" ]; then
  (cd "$TMP" && sha256sum -c --quiet "$SRC/sha256.txt") || loi "Tệp sao lưu bị thay đổi / hỏng (sai mã kiểm tra)"
fi
gzip -dc "$KG" > "$TMP/ketoan.sqlite"

if [ $MODE = thu ]; then
  echo "THỬ KHÔI PHỤC $SRC (dữ liệu đang chạy không bị ảnh hưởng)"
  docker exec $QDB psql -q -U soquy -d soquy -c "DROP DATABASE IF EXISTS soquy_kiemtra" -c "CREATE DATABASE soquy_kiemtra" >/dev/null
  docker exec -i $QDB pg_restore -U soquy -d soquy_kiemtra --no-owner < "$QD"
  docker exec $QDB psql -At -U soquy -d soquy_kiemtra -c "SELECT 'người dùng '||(SELECT count(*) FROM users)||', công ty '||(SELECT count(*) FROM companies)||', bút toán thu chi '||(SELECT count(*) FROM ledger_entries)" | sed 's/^/  • Quản trị tài chính: /'
  docker exec $QDB psql -q -U soquy -d soquy -c "DROP DATABASE soquy_kiemtra" >/dev/null
  docker exec -i $KAPP sh -c 'cat > /tmp/kiemtra.sqlite' < "$TMP/ketoan.sqlite"
  docker exec $KAPP node --no-warnings -e "
const d = new (require('node:sqlite').DatabaseSync)('/tmp/kiemtra.sqlite', { readOnly: true });
const ok = Object.values(d.prepare('PRAGMA integrity_check').get())[0];
const n = t => d.prepare('SELECT count(*) c FROM ' + t).get().c;
console.log('  • Kế toán: toàn vẹn ' + ok + ', công ty ' + n('companies') + ', chứng từ ' + n('vouchers'));
if (ok !== 'ok') process.exit(3);"
  docker exec $KAPP rm -f /tmp/kiemtra.sqlite
  mkdir -p "$BACKUP_DIR"; echo "$(date "+%F %T") THỬ KHÔI PHỤC OK – $(basename "$SRC")" >> "$BACKUP_DIR/trang-thai.txt"
  echo "Thử khôi phục thành công."
  exit 0
fi

echo "KHÔI PHỤC THẬT từ $SRC – dữ liệu hiện tại của CẢ HAI phần mềm sẽ bị thay bằng bản này."
read -rp "Gõ KHOI PHUC để tiếp tục: " ok; [ "$ok" = "KHOI PHUC" ] || loi "Đã huỷ."
echo "1/4 Sao lưu dữ liệu hiện tại trước khi thay…"; "$ROOT/scripts/auto-backup-timori.sh"
echo "2/4 Dừng 2 phần mềm…"; docker stop $QAPP $KAPP >/dev/null
echo "3/4 Khôi phục Quản trị tài chính…"
docker exec -i $QDB pg_restore -U soquy -d soquy --clean --if-exists --no-owner --single-transaction < "$QD"
echo "    Khôi phục Kế toán…"
docker run --rm -i -v $KVOL:/app/data --entrypoint sh "$(docker inspect -f '{{.Config.Image}}' $KAPP)" \
  -c "cat > $KT_DB.moi && mv $KT_DB.moi $KT_DB && rm -f $KT_DB-wal $KT_DB-shm" < "$TMP/ketoan.sqlite"
echo "4/4 Khởi động lại…"; docker start $QAPP $KAPP >/dev/null
echo "$(date "+%F %T") KHÔI PHỤC THẬT – $(basename "$SRC")" >> "$BACKUP_DIR/trang-thai.txt"
echo "Xong. Đăng nhập kiểm tra số dư, chứng từ gần nhất."
