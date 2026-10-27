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
Cần có: `hub/.env.dev`, `vhs-soquy/.env.dev`, `vhs-loans/.env.dev`, `vhs-task/.env.dev`.
1. `./scripts/up.sh`
2. Mở http://localhost:10079
3. Tắt: `./scripts/down.sh`

### Prod
Cần có: `hub/.env`, `vhs-soquy/.env`, `vhs-loans/.env`, `vhs-task/.env`.
1. `./scripts/deploy.sh`
2. Tắt: `./scripts/down.sh`, hoặc `./scripts/deploy.sh down`

Thiếu file env nào thì script dừng và báo tên file đó. Lệnh tắt không xoá dữ liệu.

---

## 2. Hub

### Chạy trên máy
- Prod: `cd hub && docker compose up -d --force-recreate`
- Dev: `cd hub && ENV_FILE=.env.dev docker compose up -d --force-recreate`

Muốn thêm hoặc sửa link app: sửa dòng `APP_<số>=Tên|URL|icon` trong file env, rồi chạy lại lệnh trên.

### Đẩy lên VPS
Cần: SSH được vào `root@45.117.169.133`.
1. `./hub/scripts/deploy.sh`
2. Tắt: `./hub/scripts/down.sh`

Nếu đích là máy hoặc thư mục khác: `HOST=root@x.x.x.x DIR=/root/abc ./hub/scripts/deploy.sh`

---

## 3. vhs-soquy (Sổ quỹ)

1. `cd vhs-soquy && cp .env.example .env`
2. Trong `.env`, sửa `POSTGRES_PASSWORD`, `SECRET_KEY`, `ADMIN_PASSWORD`, `APP_PORT=10080`.
3. `./scripts/deploy.sh`
4. Kiểm tra: `curl localhost:10080/api/health` phải trả về `{"status":"ok"}`.
5. Tắt: `./scripts/down.sh`

- Nếu cổng `APP_PORT` đang bị chiếm: `deploy.sh` sẽ xoá container và kill tiến trình đang giữ cổng đó.
- Nếu mở cổng 10080 bằng trình duyệt: trình duyệt chặn cổng này (ERR_UNSAFE_PORT), nên phải truy cập qua domain hoặc dùng cổng dev 10082.

---

## 4. vhs-loans (Khoản vay)

1. Tạo `vhs-loans/.env` với các biến:
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

1. `cd vhs-task && cp .env.example .env`
2. Trong `.env`, điền `DB_CONNECTION`, `JWT_SECRET`, lấy từ `backend/VNEB/appsettings.Local.json`. Các biến còn lại đã điền sẵn cho prod: `API_URL` và `FRONTEND_URL` là `https://erp.erpunicore.vn`, `HUB_URL` là `https://apps.erpunicore.vn`.
3. Prod: `./scripts/deploy.sh`. Dev: `docker compose --env-file .env.dev up -d --build`. Trong `.env.dev` thì `API_URL` là `http://localhost:10083`, `HUB_URL` là `http://localhost:10079`.
4. Tắt: `./scripts/down.sh`

- Nếu đặt sau reverse proxy (domain `erp.erpunicore.vn` trỏ về cổng 10083): proxy phải có `client_max_body_size 20m` và hỗ trợ WebSocket, vì SignalR cần WebSocket.
- Nếu đổi `JWT_SECRET` khác khoá đang dùng: mọi người bị đăng xuất.
- Nếu đổi `API_URL`: phải build lại web.
- Nếu đổi `HUB_URL`: chỉ cần chạy lại `docker compose up -d`, không phải build. Để trống `HUB_URL` thì nút về hub bị ẩn.
- Compose này không tạo DB, nên `DB_CONNECTION` phải trỏ tới SQL Server có sẵn `ManagementDB`.

---

## Lưu ý chung

- `docker compose down -v` sẽ **xoá luôn dữ liệu** (volume). Chỉ dùng khi muốn mất hết dữ liệu.
- Xem log: chạy `docker compose logs -f` trong thư mục của app.
