# RUNBOOK — vhs-app

| Thư mục | App | Cổng prod | Cổng dev |
|---|---|---|---|
| `hub/` | Trang tổng | 10079 | 10079 |
| `Timori-Quan-tri-tai-chinh/` | FINANCE (Quản trị tài chính) | 10080 | 10082 |
| `Timori-ke-toan-app/` | Kế toán | 10085 | 10086 |
| `vhs-task/` | Daily Work tasks (erp.erpunicore.vn) | 10083 | 10083 |

---

## 1. Chạy tất cả (hub + Timori + vhs-task)

Chạy từ thư mục gốc repo.

### Dev
Cần có: `env/hub/.env.dev`, `env/Timori-Quan-tri-tai-chinh/.env.dev`, `env/Timori-ke-toan-app/.env.dev`, `env/vhs-task/.env.dev`.
1. `./scripts/up.sh`
2. Mở http://localhost:10079
3. Tắt: `./scripts/down.sh`

### Prod
Cần có: `env/hub/.env`, `env/Timori-Quan-tri-tai-chinh/.env`, `env/Timori-ke-toan-app/.env`, `env/vhs-task/.env`.
1. `./scripts/deploy.sh`
2. Tắt: `./scripts/down.sh`, hoặc `./scripts/deploy.sh down`

Thiếu file env nào thì script dừng và báo tên file đó. Lệnh tắt không xoá dữ liệu.

Tất cả file env nằm trong thư mục `env/<app>/` ở gốc repo (đã gitignore). Chạy `docker compose` tay trong thư mục app thì luôn thêm `--env-file ../env/<app>/.env` (hoặc `.env.dev`).

---

## 2. Hub

### Chạy trên máy
- Prod: `cd hub && docker compose --env-file ../env/hub/.env up -d --force-recreate`
- Dev: `cd hub && ENV_FILE=../env/hub/.env.dev docker compose --env-file ../env/hub/.env.dev up -d --force-recreate`

Muốn thêm hoặc sửa link app: sửa dòng `APP_<số>=Tên|URL|icon` trong file env, rồi chạy lại lệnh trên.

### Đẩy lên VPS
Cần: SSH được vào `root@45.117.169.133`.
1. `./hub/scripts/deploy.sh`
2. Tắt: `./hub/scripts/down.sh`

Nếu đích là máy hoặc thư mục khác: `HOST=root@x.x.x.x DIR=/root/abc ./hub/scripts/deploy.sh`

---

## 3. Timori: Quản trị tài chính (FINANCE) + Kế toán

Hai repo riêng (đã gitignore trong monorepo), clone vào đúng thư mục:
`git clone git@github.com:vneb-vn/Timori-Quan-tri-tai-chinh.git` và `git clone git@github.com:vneb-vn/Timori-ke-toan-app.git` ở gốc repo.

Hai stack gọi nhau qua mạng Docker chung `timori` (script tự tạo): `http://qttc:8000` ↔ `http://ketoan:8770`. `INTEGRATION_KEY` (QTTC) phải bằng `FIN_KEY` (kế toán).

1. `./Timori-Quan-tri-tai-chinh/scripts/deploy.sh`. **Lần đầu** script tự chép dữ liệu FINANCE cũ từ volume `so_quy_app_pgdata` (vhs-soquy) sang `timori_qttc_pgdata`; CSDL đích đã có dữ liệu thì bỏ qua. Volume cũ giữ nguyên để rollback.
2. `./Timori-ke-toan-app/scripts/deploy.sh`
3. Kiểm tra: `curl localhost:10080/api/health` → `{"status":"ok"}`.
4. Tắt: `scripts/down.sh` trong từng thư mục.
5. Tài khoản dùng chung 2 app: `./scripts/setup-timori.sh [user] [mật khẩu] [họ tên] [vai trò]` (mặc định `chairman` / `123456`, vai trò Chủ tịch). Ghi thẳng vào CSDL, không cần mật khẩu admin; tài khoản đã có thì đặt lại mật khẩu.

- Kế toán chỉ mở `127.0.0.1:10085`; Nginx domain trỏ vào đó và `APP_ORIGIN` trong `env/Timori-ke-toan-app/.env` phải khớp domain.
- Cổng 10080 bị trình duyệt chặn (ERR_UNSAFE_PORT): truy cập qua domain hoặc cổng dev 10082.
- vhs-soquy đã ngừng dùng, chỉ còn là nguồn dữ liệu cho lần migrate đầu.

---

## 4. vhs-task (Daily Work tasks)

Web (cổng 10083) chuyển `/api`, `/uploads`, `/notificationHub` sang API, nên chỉ cần 1 domain. Cổng API 10084 chỉ mở trên 127.0.0.1.

1. `cd vhs-task && cp .env.example ../env/vhs-task/.env`
2. Trong `env/vhs-task/.env`, điền `DB_CONNECTION`, `JWT_SECRET`, lấy từ `backend/VNEB/appsettings.Local.json`. Các biến còn lại đã điền sẵn cho prod: `API_URL` và `FRONTEND_URL` là `https://erp.erpunicore.vn`, `HUB_URL` là `https://apps.erpunicore.vn`.
3. Prod: `./scripts/deploy.sh`. Dev: `docker compose --env-file ../env/vhs-task/.env.dev up -d --build`. Trong `env/vhs-task/.env.dev` thì `API_URL` là `http://localhost:10083`, `HUB_URL` là `http://localhost:10079`.
4. Tắt: `./scripts/down.sh`

- Nếu đặt sau reverse proxy (domain `erp.erpunicore.vn` trỏ về cổng 10083): proxy phải có `client_max_body_size 20m` và hỗ trợ WebSocket, vì SignalR cần WebSocket.
- Nếu đổi `JWT_SECRET` khác khoá đang dùng: mọi người bị đăng xuất.
- Nếu đổi `API_URL`: phải build lại web.
- Nếu đổi `HUB_URL`: chỉ cần chạy lại `docker compose up -d`, không phải build. Để trống `HUB_URL` thì nút về hub bị ẩn.
- Compose này không tạo DB, nên `DB_CONNECTION` phải trỏ tới SQL Server có sẵn `ManagementDB`.

---

## 5. Sao lưu & chuyển VPS

| Script | Dùng khi |
|---|---|
| `scripts/auto-backup-timori.sh` | Sao lưu DB 2 app Timori mỗi đêm (cron), không dừng app |
| `scripts/restore-timori.sh` | Thử khôi phục mỗi tháng, hoặc khôi phục khi mất dữ liệu |
| `scripts/backup.sh` / `restore.sh` | Chỉ khi chuyển sang VPS mới |

### Sao lưu hằng đêm — cài một lần

```sh
apt install -y gnupg rclone
openssl rand -base64 32 > /root/.timori-sao-luu-pass && chmod 600 /root/.timori-sao-luu-pass   # giao Chủ tịch giữ
printf 'BACKUP_PASS_FILE=/root/.timori-sao-luu-pass\nKEEP_DAYS=30\nRCLONE_REMOTE=\n' > /etc/timori.conf && chmod 600 /etc/timori.conf
./scripts/auto-backup-timori.sh                                  # chạy thử
echo '0 1 * * * root /root/apps/vhs-apps/scripts/auto-backup-timori.sh >> /var/log/timori-sao-luu.log 2>&1' > /etc/cron.d/timori-sao-luu
```

Bản sao lưu nằm ở `/root/apps/sao-luu/`. Chép thêm lên Google Drive: cấu hình `rclone config` (remote `gdrive`), đặt `RCLONE_REMOTE=gdrive:TIMORI-sao-luu`.

### Kiểm tra & khôi phục

- Hằng ngày: `tail -3 /root/apps/sao-luu/trang-thai.txt` → phải có `OK`.
- Mỗi tháng: `./scripts/restore-timori.sh --kiem-tra /root/apps/sao-luu/<thư mục>` (không đụng dữ liệu đang chạy).
- Mất dữ liệu: `./scripts/restore-timori.sh /root/apps/sao-luu/<thư mục>` → gõ `KHOI PHUC`. Script tự sao lưu hiện trạng trước khi thay.

### Chuyển VPS

1. VPS cũ: `./scripts/backup.sh` (nén 3 volume + `env/` thành `migrate-<thời gian>.tar.gz`).
2. `scp migrate-….tar.gz` sang VPS mới.
3. VPS mới: clone repo + 2 repo Timori (mục 3), cài Docker, `./scripts/restore.sh migrate-….tar.gz`, rồi `./scripts/deploy.sh`.
4. Mở allowlist IP mới ở máy SQL Server cho vhs-task; đổi DNS, xin lại SSL.

---

## Lưu ý chung

- `docker compose down -v` sẽ **xoá luôn dữ liệu** (volume). Chỉ dùng khi muốn mất hết dữ liệu.
- Xem log: chạy `docker compose --env-file ../env/<app>/.env logs -f` trong thư mục của app.
