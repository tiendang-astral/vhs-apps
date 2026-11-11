# vhs-app — quy ước chung

Monorepo nhiều app, mỗi app một compose stack; `hub/` là trang chủ. Vận hành: [RUNBOOK.md](RUNBOOK.md).

## Env

- Env nằm ở `env/<tên-thư-mục-app>/`, mỗi folder có `.env` (prod) và `.env.dev` (dev).
- Trong app chỉ để `.env.example`, không secret thật.
- Chạy: `docker compose --env-file ../env/<app>/.env up -d`.

## Hub ↔ App

- Mỗi app có float button về hub (`HUB_URL`, trống = ẩn). Mẫu: [vhs-soquy/web/index.html](vhs-soquy/web/index.html).
- Hub liệt kê app bằng `APP_<n>=Tên|URL|icon` trong `env/hub/.env` và `.env.dev`.
- Thêm/đổi app → rà soát: app có float button chưa, hub có link chưa, RUNBOOK cập nhật chưa.

## Docker compose

Đặt tên tường minh, tránh tên mặc định Docker tự sinh. Mẫu: [Timori-Quan-tri-tai-chinh/docker-compose.yml](Timori-Quan-tri-tai-chinh/docker-compose.yml).

- `name: <stack>` ở đầu file, snake_case, duy nhất.
- Service theo vai trò (`db`, `app`, `api`, `web`); `container_name: <stack>_<service>`.
- Volume luôn có `name: <stack>_<mục-đích>`; network default `<stack>_net`; mạng dùng chung để `external` + `aliases`.
- Port lấy từ env, không trùng giữa các app.
- Stack đã có dữ liệu prod: kiểm tra `docker volume ls` trước khi đổi tên, tránh mất dữ liệu.
