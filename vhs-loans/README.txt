CÀI ĐẶT (Ubuntu/Debian, Python 3.10+)
1. python3 -m venv venv && . venv/bin/activate && pip install -r requirements.txt
2. ADMIN_PASSWORD="MatKhauManh" KETOAN_PASSWORD="MatKhauKeToan" gunicorn -w 2 -b 0.0.0.0:8000 app:app
   (lần chạy đầu tạo CSDL data/loans.db, nạp 47 khoản từ seed.json, tạo tài khoản admin)
3. Mở http://<IP-máy-chủ>:8000  – đăng nhập admin, vào "Tài khoản" để tạo user cho kế toán.
Khuyến nghị: đặt sau Nginx + HTTPS; sao lưu dữ liệu hằng ngày.
Chạy bằng Docker: dữ liệu nằm trong volume vhs-loans-data. Chép từ thư mục data cũ vào volume (app đang tắt):
  docker run --rm -v vhs-loans-data:/dst -v /đường/dẫn/data:/src alpine cp -a /src/. /dst/
