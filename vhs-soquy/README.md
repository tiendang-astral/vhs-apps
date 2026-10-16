# QUẢN TRỊ TÀI CHÍNH TIMORI GROUP

Ứng dụng web quản trị dòng tiền cho các công ty trong tập đoàn, phát triển từ file Excel *Sổ quỹ VHS Group v8*. Mọi khoản thu chi đều đi qua quy trình duyệt nhiều cấp:

**Lập → Duyệt cấp 1 (Kế toán trưởng / Kế toán duyệt lương) → Duyệt cấp 2 (GĐ công ty trụ cột – Admin 2) → Admin tập đoàn duyệt cuối.**

Khi Admin tập đoàn duyệt cuối, hệ thống tự ghi sổ và cập nhật ngay báo cáo, Dashboard.

- **Backend:** Python 3.11+, Starlette và Uvicorn. Dùng PostgreSQL khi chạy thật, SQLite khi chạy thử.
- **Frontend:** HTML/CSS/JavaScript thuần (ES modules), không cần bước build. Biểu đồ vẽ bằng SVG.
- **Kiểm thử:** `tests/test_flow.py` có 91 bài kiểm thử, đạt 91/91 trên cả SQLite và PostgreSQL 16.
- **Dữ liệu cũ:** nạp sẵn 441 giao dịch từ file Excel (T4–T5/2026). Tổng số dư sau khi nạp là **863.233.490 đ**, khớp với file Excel.
- **Cập nhật từ bản cũ:** khi khởi động, chương trình tự thêm các cột mới vào CSDL đã có, không cần chạy lệnh nâng cấp.

---

## 1. Triển khai lên server (Docker, khuyến nghị)

Yêu cầu: server Linux (Ubuntu 22.04/24.04) đã cài Docker và Docker Compose.

```bash
# 1. Chép thư mục so_quy_app lên server, ví dụ /opt/so_quy_app
cd /opt/so_quy_app
cp .env.example .env
nano .env          # đổi POSTGRES_PASSWORD, SECRET_KEY, ADMIN_PASSWORD

# 2. Khởi động (lần đầu sẽ tự tạo bảng, tạo tài khoản admin, nạp dữ liệu Excel cũ)
docker compose up -d --build

# 3. Kiểm tra
docker compose ps
curl http://localhost:8000/api/health      # {"status":"ok"}
```

Sau đó mở trình duyệt tới `http://<IP-server>:8000` và đăng nhập bằng `ADMIN_USERNAME` / `ADMIN_PASSWORD`. **Đổi mật khẩu ngay** ở menu góc phải, mục Đổi mật khẩu.

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
| `APP_NAME` | Tên hiển thị của ứng dụng | `QUẢN TRỊ TÀI CHÍNH TIMORI GROUP` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_FULLNAME` | Tài khoản Admin tập đoàn, chỉ được tạo khi CSDL còn trống | `admin` / `Admin@123` |
| `SEED_LEGACY` | `1` = nạp dữ liệu sổ quỹ Excel cũ khi CSDL trống | `1` |
| `TOKEN_HOURS` | Số giờ một phiên đăng nhập còn hiệu lực | `12` |
| `DB_POOL_SIZE` | Số kết nối CSDL giữ sẵn | `10` |

## 4. Quy trình và phân quyền

| Nghiệp vụ | Người lập | Duyệt cấp 1 | Duyệt cấp 2 | Duyệt cuối |
|---|---|---|---|---|
| Thu Chi & Vay nợ (gồm Phí ngân hàng / SMS, Chi khác) | Kế toán (quyền *lập Thu Chi*) | Kế toán trưởng phụ trách công ty | GĐ công ty trụ cột | Admin tập đoàn → **ghi sổ** |
| Thanh toán đối tác | Kế toán (quyền *lập Thanh toán đối tác*) | Kế toán trưởng | GĐ công ty trụ cột | Admin tập đoàn → **ghi sổ** |
| Quỹ TM & tạm ứng | Kế toán / thủ quỹ | Kế toán trưởng | GĐ công ty trụ cột | Admin tập đoàn → **ghi sổ** |
| Thanh toán lương (nhập tay hoặc **tải lên biểu mẫu Excel**) | Nhân sự (quyền *lập Thanh toán lương*) | Kế toán có quyền *duyệt lương* | GĐ công ty trụ cột | Admin tập đoàn → **ghi sổ** |

**Tài khoản GĐ công ty trụ cột (Admin 2):**

- Mỗi nhóm trụ cột (GROUP TPE, GROUP VHS, GROUP ASTRAL-X) có thể có một tài khoản Admin 2. Admin tập đoàn tạo tài khoản này và bấm **Cả nhóm** để giao toàn bộ công ty của nhóm.
- Admin 2 duyệt cấp 2 cho các công ty trong nhóm, xem Dashboard, Chi tiết và Tổng hợp của nhóm mình.
- Nếu một nhóm chưa có tài khoản Admin 2, chứng từ của nhóm đó chuyển thẳng từ duyệt cấp 1 lên Admin tập đoàn.

**Nhập lương từ Excel:**

1. Vào trang *Thanh toán lương* → bấm **Tải biểu mẫu Excel**. Biểu mẫu có sẵn danh sách chọn mã công ty, mã TK chi trả và nhân viên, chỉ gồm những công ty người dùng phụ trách.
2. Điền mỗi nhân viên một dòng.
3. Bấm **Nhập từ Excel** và chọn file. Hệ thống kiểm tra từng dòng, gồm:
   - công ty có thuộc phạm vi phụ trách không;
   - TK chi trả có tồn tại và còn hoạt động không;
   - thực lĩnh có lớn hơn 0 không;
   - dòng có trùng không (cùng công ty + kỳ lương + nhân viên, lặp trong file hoặc đã có trên hệ thống).
4. Chỉ khi **tất cả** các dòng hợp lệ mới nhập; tick *Gửi duyệt luôn* nếu muốn gửi duyệt ngay sau khi nhập.

Quy tắc chung:

- **Trạng thái chứng từ:** Nháp → Chờ duyệt cấp 1 → Chờ GĐ công ty trụ cột → Chờ Admin duyệt cuối → Đã duyệt & ghi sổ (hoặc Đã hủy).
- **Người lập không được tự duyệt** chứng từ của mình.
- **Phạm vi công ty:** Nhân viên và Kế toán trưởng chỉ thấy, lập và duyệt chứng từ của các công ty được giao.
- **Mở lại chứng từ:** sau khi gửi duyệt, chứng từ không sửa được nữa. Người lập hoặc người duyệt bấm *Đề nghị mở lại* và ghi lý do. **Chỉ Admin tập đoàn** được mở lại chứng từ về Nháp; nếu chứng từ đã ghi sổ thì bút toán tự bị hủy. Kế toán trưởng và GĐ công ty trụ cột không có quyền mở lại.
- **Dữ liệu khai báo** (công ty, nhóm, ngân hàng, tài khoản và quỹ tiền mặt, hạng mục, đối tác và nhân viên): mọi tài khoản đều được thêm, sửa, xóa khi dữ liệu còn ở trạng thái Nháp. Sau khi bấm **Khóa (Submit)** thì không sửa hay xóa được nữa; chỉ Admin tập đoàn mở khóa được.
- **Tài khoản người dùng:** Admin tập đoàn thêm, sửa, xóa tài khoản Nhân viên, Kế toán trưởng và GĐ công ty trụ cột, giao công ty phụ trách và quyền nghiệp vụ. Tài khoản đã có chứng từ sẽ bị khóa thay vì xóa, để giữ lịch sử.

Quyền xem theo loại tài khoản:

| Màn hình | Nhân viên | Kế toán trưởng | GĐ công ty trụ cột | Admin tập đoàn |
|---|---|---|---|---|
| Nghiệp vụ được giao hoặc được duyệt | ✓ | ✓ | ✓ (cả nhóm) | ✓ |
| Chi tiết theo ngày / tháng | ✓ (công ty phụ trách) | ✓ | ✓ | ✓ |
| Tổng hợp theo ngày / tháng | – | ✓ | ✓ | ✓ |
| Dashboard | – | – | ✓ (các công ty trong nhóm) | ✓ (toàn tập đoàn, lọc được theo nhóm) |
| Kiểm soát hạch toán, Tài khoản người dùng | – | – | – | ✓ |

Trang **Hướng dẫn nhập liệu** trong ứng dụng thay cho sheet "Hướng dẫn" của file Excel.

## 5. Cấu trúc mã nguồn

```
app/
  main.py              khởi động ứng dụng, xử lý lỗi, phục vụ giao diện web
  config.py            đọc biến môi trường
  db.py                lớp truy cập CSDL (PostgreSQL / SQLite), schema
  security.py          mã hóa mật khẩu (PBKDF2), JWT
  permissions.py       vai trò, quyền, phạm vi công ty
  modules/             MỖI NGHIỆP VỤ = 1 FILE (trường nhập, kiểm tra, cách ghi sổ)
    cashbook.py  partner_payment.py  payroll.py  cash_fund.py
  services/
    workflow.py        quy trình lập, gửi, duyệt, ghi sổ, mở lại, hủy (dùng chung)
    masterdata.py      dữ liệu khai báo, khóa / mở khóa
    reports.py         sổ chi tiết, tổng hợp, dashboard, kiểm soát
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
POST /api/docs/{module}/{id}/{submit|approve|request_reopen|reopen|cancel}   {"note"}
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

`module` nhận một trong các giá trị `cashbook`, `partner_payment`, `payroll`, `cash_fund`. `table` nhận một trong các giá trị `companies`, `company_groups`, `banks`, `accounts`, `categories`, `partners`.
