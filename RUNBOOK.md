# RUNBOOK — vhs-app

| Thư mục | App | Cổng prod | Cổng dev |
|---|---|---|---|
| `hub/` | Trang tổng | 10079 | 10079 |
| `vhs-soquy/` | Sổ quỹ | 10080 | 10082 |
| `vhs-loans/` | Khoản vay | 10081 | 10081 |
| `vhs-task/` | Daily Work tasks (erp.erpunicore.vn) | 10083 | 10083 |

---

## 1. Chạy tất cả (hub + soquy + loans + vhs-task)

Chạy từ thư mục gốc repo.

### Dev
Cần có: `env/hub/.env.dev`, `env/vhs-soquy/.env.dev`, `env/vhs-loans/.env.dev`, `env/vhs-task/.env.dev`.
1. `./scripts/up.sh`
2. Mở http://localhost:10079
3. Tắt: `./scripts/down.sh`

### Prod
Cần có: `env/hub/.env`, `env/vhs-soquy/.env`, `env/vhs-loans/.env`, `env/vhs-task/.env`.
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

## 3. vhs-soquy (Sổ quỹ)

1. `cd vhs-soquy && cp .env.example ../env/vhs-soquy/.env`
2. Trong `env/vhs-soquy/.env`, sửa `POSTGRES_PASSWORD`, `SECRET_KEY`, `ADMIN_PASSWORD`, `APP_PORT=10080`.
3. `./scripts/deploy.sh`
4. Kiểm tra: `curl localhost:10080/api/health` phải trả về `{"status":"ok"}`.
5. Tắt: `./scripts/down.sh`

- Nếu cổng `APP_PORT` đang bị chiếm: `deploy.sh` sẽ xoá container và kill tiến trình đang giữ cổng đó.
- Nếu mở cổng 10080 bằng trình duyệt: trình duyệt chặn cổng này (ERR_UNSAFE_PORT), nên phải truy cập qua domain hoặc dùng cổng dev 10082.

---

## 4. vhs-loans (Khoản vay)

1. Tạo `env/vhs-loans/.env` với các biến:
   ```
   PORT=10081
   ADMIN_PASSWORD=...
   KETOAN_PASSWORD=...
   HUB_URL=https://apps.erpunicore.vn
   ```
2. `./vhs-loans/scripts/deploy.sh`
3. Tắt: `./vhs-loans/scripts/down.sh`

- Nếu DB đã có sẵn: `ADMIN_PASSWORD` / `KETOAN_PASSWORD` bị bỏ qua, vì chúng chỉ dùng ở lần chạy đầu.
- Nếu cần chép dữ liệu cũ vào: tắt app trước, rồi chạy
  `docker run --rm -v vhs-loans-data:/dst -v /duong/dan/data:/src alpine cp -a /src/. /dst/`

---

## 5. vhs-task (Daily Work tasks)

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

## 6. Sao lưu & chuyển VPS

Gồm 2 script. Dữ liệu cần mang theo: 3 volume (`vhs-task_uploads`, `so_quy_app_pgdata`, `vhs-loans-data`) + thư mục `env/`. Code đã có trong git. DB SQL Server nằm máy khác, không nằm trong backup.

- **`./scripts/backup.sh`** (chạy ở VPS **cũ**): dừng các stack cho dữ liệu nhất quán (nhất là Postgres), nén 3 volume + thư mục `env/` thành 1 file `migrate-<thời gian>.tar.gz`, rồi bật lại stack. VPS cũ vẫn chạy tiếp sau khi backup.
- **`./scripts/restore.sh migrate-….tar.gz`** (chạy ở VPS **mới**, trong repo đã `git clone`): bung `env/` về chỗ cũ và nạp lại 3 volume. Không tự chạy app.

### Các bước chuyển VPS
1. VPS cũ: `./scripts/backup.sh`
2. `scp migrate-….tar.gz user@VPS_MOI:/duong-dan/repo/`
3. VPS mới: `git clone` repo, cài Docker, rồi `./scripts/restore.sh migrate-….tar.gz`
4. Deploy: `./scripts/deploy.sh` (chạy cả 4 app).
5. Mở allowlist IP VPS mới ở máy SQL Server (`103.176.179.125`) cho vhs-task.
6. Đổi DNS trỏ về IP VPS mới (làm cuối cùng để giảm gián đoạn), rồi xin lại chứng chỉ SSL.

---

## Lưu ý chung

- `docker compose down -v` sẽ **xoá luôn dữ liệu** (volume). Chỉ dùng khi muốn mất hết dữ liệu.
- Xem log: chạy `docker compose --env-file ../env/<app>/.env logs -f` trong thư mục của app.
