# QUẢN TRỊ TÀI CHÍNH TIMORI GROUP

Ứng dụng web quản trị dòng tiền cho các công ty trong tập đoàn, phát triển từ file Excel *Sổ quỹ VHS Group v8*. Từ phiên bản 2 (11/2026), luồng duyệt theo **Mô hình Tài chính – Kế toán TIMORI GROUP (v06)**: khi gửi duyệt, hệ thống tự lập *tuyến duyệt* cho từng chứng từ theo số tiền, ngưỡng N và loại giao dịch:

**KTV lập → KTTH kiểm tra → CFO kiểm soát cấp 1 → (KSNB kiểm trước) → Giám đốc nhóm → (Chủ tịch) → Ngân quỹ chi, ghi số UNC → ghi sổ.**

Khi bước cuối của tuyến hoàn tất, hệ thống tự ghi sổ và cập nhật ngay báo cáo, Dashboard.

- **Backend:** Python 3.11+, Starlette và Uvicorn. Dùng PostgreSQL khi chạy thật, SQLite khi chạy thử.
- **Frontend:** HTML/CSS/JavaScript thuần (ES modules), không cần bước build. Biểu đồ vẽ bằng SVG.
- **Kiểm thử:** `tests/test_flow.py` có 152 bài kiểm thử (luồng duyệt mới, phân hệ Khoản vay, xóa dữ liệu mẫu), đạt 152/152 trên cả SQLite và PostgreSQL 16.
- **Dữ liệu:** mặc định bắt đầu trắng, kế toán nhập liệu mới. Dữ liệu mẫu Excel cũ (441 giao dịch) chỉ nạp khi đặt `SEED_LEGACY=1` để chạy thử.
- **Cập nhật từ bản cũ:** khi khởi động, chương trình tự thêm các cột mới vào CSDL đã có, không cần chạy lệnh nâng cấp.

---

## 1. Triển khai lên server (Docker, khuyến nghị)

Yêu cầu: server Linux (Ubuntu 22.04/24.04) đã cài Docker và Docker Compose.

```bash
# 1. Chép thư mục so_quy_app lên server, ví dụ /opt/so_quy_app
cd /opt/so_quy_app
cp .env.example .env
nano .env          # đổi POSTGRES_PASSWORD, SECRET_KEY, ADMIN_PASSWORD

# 2. Khởi động (lần đầu sẽ tự tạo bảng, tài khoản admin và cơ cấu tập đoàn; không nạp dữ liệu mẫu)
docker compose up -d --build

# 3. Kiểm tra
docker compose ps
curl http://localhost:8000/api/health      # {"status":"ok"}
```

Sau đó mở trình duyệt tới `http://<IP-server>:8000` và đăng nhập bằng `ADMIN_USERNAME` / `ADMIN_PASSWORD` (tài khoản Quản trị hệ thống). **Đổi mật khẩu ngay** ở menu góc phải, mục Đổi mật khẩu.

### Gắn tên miền và HTTPS (Nginx)

```nginx
server {
    server_name soquy.vhsgroup.vn;
    client_max_body_size 5m;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Cấp chứng chỉ SSL miễn phí: `sudo certbot --nginx -d soquy.vhsgroup.vn`.

### Sao lưu và phục hồi

```bash
# Sao lưu hằng ngày (nên đưa vào crontab)
docker compose exec -T db pg_dump -U soquy soquy | gzip > /backup/soquy_$(date +%F).sql.gz

# Phục hồi
gunzip -c soquy_2026-10-04.sql.gz | docker compose exec -T db psql -U soquy soquy
```

### Cập nhật phiên bản mới

```bash
docker compose up -d --build app
```

Dữ liệu nằm trong volume `pgdata` nên không bị mất khi cập nhật.

## 2. Chạy thử trên máy cá nhân (không cần Docker)

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000     # mặc định dùng SQLite: data/soquy.db
python tests/test_flow.py                     # chạy toàn bộ kiểm thử quy trình
```

Để chạy kiểm thử trên PostgreSQL:

```bash
TEST_DATABASE_URL=postgresql://user:pass@host/db_trong python tests/test_flow.py
```

## 3. Biến môi trường

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` hoặc `sqlite:///path.db` | `sqlite:///data/soquy.db` |
| `SECRET_KEY` | Chuỗi bí mật dùng để ký phiên đăng nhập, ≥ 32 ký tự | tự sinh và lưu vào `data/.secret_key` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_FULLNAME` | Tài khoản Quản trị hệ thống, chỉ được tạo khi CSDL còn trống | `admin` / `Admin@123` |
| `APPROVAL_THRESHOLD` | Ngưỡng N mặc định (đ) khi nhóm chưa đặt ngưỡng riêng | `200000000` |
| `SEED_LEGACY` | `1` = nạp dữ liệu mẫu Excel cũ khi CSDL trống (chỉ chạy thử) | `0` |
| `TOKEN_HOURS` | Số giờ một phiên đăng nhập còn hiệu lực | `12` |
| `DB_POOL_SIZE` | Số kết nối CSDL giữ sẵn | `10` |

## 4. Quy trình và phân quyền (phiên bản 2 – theo mô hình kế toán mới)

### Tuyến duyệt

| Loại chứng từ | Tuyến duyệt |
|---|---|
| Khoản chi thường, đến ngưỡng N | KTTH kiểm tra → CFO kiểm soát cấp 1 → Giám đốc nhóm → Ngân quỹ chi & ghi sổ |
| Khoản chi trên ngưỡng N | KTTH → CFO → KSNB kiểm tra trước → Giám đốc nhóm → Chủ tịch → Ngân quỹ chi |
| Giao dịch đặc biệt (vay, góp vốn, chuyển nguồn giữa hai pháp nhân, NCC mới, bên liên quan VHS – DP / MPN, ngoại tệ nhập thiết bị, bảo lãnh) | KTTH → CFO → KSNB → Chủ tịch → (Ngân quỹ chi nếu có tiền ra). Giám đốc nhóm không duyệt |
| Khoản thu thường | KTTH kiểm tra → ghi sổ |
| Bảng lương | KTTH hoặc KTV lương kiểm tra → CFO → Giám đốc nhóm → Ngân quỹ chi |

- **Ngưỡng N**: đặt cho từng nhóm ở *Dữ liệu khai báo → Nhóm công ty* (cột Ngưỡng N); để trống dùng biến `APPROVAL_THRESHOLD` (mặc định 200.000.000 đ).
- **Giai đoạn 2**: tạo tài khoản *Kế toán trưởng nhóm* → KTT nhóm kiểm soát cấp 1 khoản đến N của nhóm; khoản trên N và đặc biệt vẫn do CFO.
- Công ty chưa có tài khoản Giám đốc nhóm: bước Giám đốc nhóm được thay bằng Chủ tịch.
- Người lập không tự duyệt; **mỗi người chỉ duyệt một bước** trên cùng chứng từ.
- Người duyệt bấm **Trả lại** (ghi lý do) → chứng từ về Nháp; người lập sửa và gửi lại từ đầu.
- **Ngân quỹ** bấm *Xác nhận đã chi & ghi sổ* sau khi lệnh ngân hàng đã thực hiện, bắt buộc ghi số UNC (tự lưu vào Số chứng từ).
- **KSNB** hậu kiểm chứng từ đã ghi sổ ở tab *Chờ hậu kiểm*.
- **Mở lại / hủy**: chỉ Quản trị hệ thống. Mở lại chứng từ đã ghi sổ sẽ hủy bút toán và xóa các lần duyệt.

### Vai trò

| Vai trò | Phạm vi | Việc trên hệ thống |
|---|---|---|
| Nhân viên / Kế toán viên | Công ty được giao | Lập chứng từ theo quyền được tick; KTV lương kiểm tra bảng lương |
| KTTH – Phụ trách kế toán | Công ty được giao | Bước KTTH kiểm tra hồ sơ; xem Tổng hợp |
| Kế toán trưởng nhóm (giai đoạn 2) | Công ty được giao | Kiểm soát cấp 1 khoản đến N |
| Giám đốc tài chính (CFO) | Toàn tập đoàn | Kiểm soát cấp 1; Dashboard; Kiểm soát hạch toán |
| Kiểm soát nội bộ (KSNB) | Toàn tập đoàn | Kiểm tra trước khoản trên N / đặc biệt; hậu kiểm; Kiểm soát hạch toán |
| Giám đốc nhóm | Công ty trong nhóm | Duyệt cấp 2; Dashboard nhóm |
| Chủ tịch | Toàn tập đoàn | Duyệt khoản trên N, giao dịch đặc biệt; Dashboard |
| Ngân quỹ – Thanh toán | Toàn tập đoàn | Xác nhận đã chi, ghi số UNC, ghi sổ |
| Quản trị hệ thống | Toàn tập đoàn | Tài khoản, dữ liệu khai báo, mở lại / hủy chứng từ; **không duyệt chi** |

### Nâng cấp từ phiên bản 1

Khi khởi động, chương trình tự thêm cột / bảng mới và chuyển chứng từ đang chờ duyệt sang tuyến mới (Chờ duyệt cấp 1 → Chờ KTTH; Chờ GĐ trụ cột → Chờ kiểm soát cấp 1; Chờ Admin duyệt cuối → bước kế tiếp sau Giám đốc nhóm). Sau khi nâng cấp, Quản trị hệ thống cần **tạo tài khoản CFO, Chủ tịch, Ngân quỹ, KSNB** ; tài khoản "Kế toán trưởng" cũ tự trở thành KTTH, "GĐ công ty trụ cột" cũ tự trở thành Giám đốc nhóm. Tài khoản `admin` không còn quyền duyệt chi.

**Nhập lương từ Excel:** Trang *Thanh toán lương* → **Tải biểu mẫu Excel** → điền mỗi nhân viên một dòng → **Nhập từ Excel**. Hệ thống kiểm tra từng dòng (công ty phụ trách, TK chi trả, thực lĩnh > 0, trùng kỳ lương) và chỉ nhập khi tất cả các dòng hợp lệ.

**Dữ liệu khai báo**: thêm / sửa / xóa khi còn Nháp; sau khi **Khóa (Submit)** chỉ Quản trị hệ thống mở khóa được.

### Phân hệ Khoản vay (phiên bản 3 – 11/2026)

- **Hồ sơ vay** (nghiệp vụ `loan`, Ngân quỹ lập): Hạn mức tín dụng, Hợp đồng vay / khế ước, Gia hạn / cơ cấu nợ, Tài sản bảo đảm / bảo lãnh → KTTH → CFO → KSNB → **Chủ tịch duyệt cuối**; Điều chỉnh lãi suất, Đối chiếu dư nợ → KTTH → CFO → **Chủ tịch**. Hồ sơ được duyệt tự cập nhật sổ khoản vay.
- **Giải ngân / trả gốc / trả lãi** lập ở Thu Chi & Vay nợ, bắt buộc chọn khoản vay: giải ngân KTTH → CFO → Chủ tịch; trả nợ KTTH → CFO → Giám đốc nhóm → Chủ tịch → Ngân quỹ chi; **trả trước hạn toàn bộ khế ước** thêm KSNB. Chặn giải ngân vượt số tiền vay, trả gốc vượt dư nợ.
- **Dư nợ** = giải ngân − trả gốc đã ghi sổ (không sửa tay). Trang *Khoản vay*: Dashboard, danh sách khoản vay / hạn mức, lịch trả nợ 90 ngày, cảnh báo (thiếu lãi suất, lãi > 10%, đến hạn 90/30/7 ngày, quá hạn, chưa đối chiếu tháng, bảo hiểm TSĐB), bảo lãnh chéo giữa các công ty.
- API: `GET /api/loans`, `/api/loans/dashboard`, `/api/loans/schedule?days=90`, `/api/loans/{id}`.

### Xóa dữ liệu mẫu cũ

Mặc định (`SEED_LEGACY=0`) cài mới chỉ tạo cơ cấu tập đoàn (nhóm, công ty, ngân hàng, hạng mục), không nạp dữ liệu Excel cũ. Với CSDL đang chạy đã có dữ liệu mẫu, **sao lưu trước** rồi chạy:

```bash
docker compose exec app python -m app.reset_data --yes          # xóa chứng từ, sổ, khoản vay, TK NH/quỹ, đối tác
docker compose exec app python -m app.reset_data --yes --keep-master   # giữ TK NH/quỹ và đối tác
```

Giữ nguyên: tài khoản người dùng, công ty, nhóm (ngưỡng N), ngân hàng, hạng mục.

## 5. Cấu trúc mã nguồn

```
app/
  main.py              khởi động ứng dụng, xử lý lỗi, phục vụ giao diện web
  config.py            đọc biến môi trường
  db.py                lớp truy cập CSDL (PostgreSQL / SQLite), schema
  security.py          mã hóa mật khẩu (PBKDF2), JWT
  permissions.py       vai trò, quyền, phạm vi công ty
  modules/             MỖI NGHIỆP VỤ = 1 FILE (trường nhập, kiểm tra, cách ghi sổ)
    cashbook.py  partner_payment.py  payroll.py  cash_fund.py  loan.py (hồ sơ vay)
  services/
    workflow.py        tuyến duyệt (build_route), lập, gửi, duyệt, trả lại, chi & ghi sổ, hậu kiểm, mở lại, hủy
    masterdata.py      dữ liệu khai báo, khóa / mở khóa
    reports.py         sổ chi tiết, tổng hợp, dashboard, kiểm soát
    loans.py           sổ khoản vay, dư nợ, lịch trả nợ, cảnh báo, Dashboard vay
    users.py  guide.py
  api/routes.py        REST API
  seed/                tạo admin, nạp dữ liệu Excel cũ
web/                   giao diện (index.html, css/, js/)
tests/test_flow.py     kiểm thử toàn bộ quy trình qua HTTP
```

### Thêm nghiệp vụ mới

1. Tạo file `app/modules/<ten>.py` kế thừa `Module`. Khai báo các phần sau:
   - `key`, `title`, `table`, `fields` (danh sách trường nhập);
   - `validate()` để kiểm tra dữ liệu;
   - `lines()` trả về các bút toán ghi sổ.
2. Đăng ký nghiệp vụ trong `app/modules/__init__.py` và thêm bảng vào `SCHEMA` trong `db.py`. Nếu cần quyền lập riêng, thêm quyền vào `PERMISSIONS`.

Giao diện tự sinh form, danh sách, quy trình duyệt và báo cáo cho nghiệp vụ mới, không cần sửa JavaScript.

## 6. Kết nối công cụ khác (API)

Mọi chức năng đều có REST API dạng JSON, nên ERP, BI, app di động hay Google Sheets đều kết nối được.

```
POST /api/auth/login               {"username","password"} → {"token"}
     (các lệnh sau gửi kèm header:  Authorization: Bearer <token>)
GET  /api/me  /api/meta  /api/options  /api/guide
GET  /api/docs/{module}?status=&company_id=&from=&to=&q=&limit=&offset=
POST /api/docs/{module}            tạo chứng từ ("_submit": true để gửi duyệt luôn)
GET|PUT|DELETE /api/docs/{module}/{id}
POST /api/docs/{module}/{id}/{submit|approve|reject|audit|request_reopen|reopen|cancel}   {"note"}  (approve ở bước Ngân quỹ: note = số UNC)
POST /api/docs/{module}/bulk       {"ids":[...], "action":"approve"}
GET  /api/docs/{module}/template   tải biểu mẫu Excel (module có hỗ trợ nhập, hiện là payroll)
POST /api/docs/{module}/import     {"file": "<base64 .xlsx>", "filename", "dry_run": true|false, "submit": true|false}
GET  /api/inbox                    chứng từ chờ người dùng hiện tại duyệt
GET|POST /api/master/{table}       PUT|DELETE /api/master/{table}/{id}
POST /api/master/{table}/lock|unlock   {"ids":[...]}
GET  /api/reports/ledger?from=&to=&company_id=&account_id=&category_id=
GET  /api/reports/summary-day?date=     /api/reports/summary-month?month=YYYY-MM
GET  /api/reports/dashboard?month=&date=&group_id=    /api/reports/control
GET|POST /api/users    PUT|DELETE /api/users/{id}
GET  /api/routes       danh sách toàn bộ endpoint
```

`module` nhận một trong các giá trị `cashbook`, `partner_payment`, `payroll`, `cash_fund`, `loan`. `table` nhận một trong các giá trị `companies`, `company_groups`, `banks`, `accounts`, `categories`, `partners`.
