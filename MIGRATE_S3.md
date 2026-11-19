# Chuyển tệp đính kèm QTTC từ CSDL sang kho S3

Áp dụng cho `Timori-Quan-tri-tai-chinh`. Code đã có sẵn (`app/services/filestore.py`), chỉ cần cấu hình và chạy lệnh.

- Lệnh chạy ở gốc repo vhs-app trên máy local.
- Khai báo trước:

  ```sh
  VPS=root@103.176.179.125; D=/root/apps/vhs-apps
  F="docker exec timori_qttc_app python -m app.filestore"
  ```

> ⚠️ Làm xong bước 6 thì gần như **không quay lại được**: không có lệnh chuyển tệp ngược về CSDL.

---

## 1. Tạo bucket ở nhà cung cấp

Cấu hình bucket: **Private**, **bật Versioning**, access key **chỉ có quyền trên bucket này**.

Ghi lại 5 thông tin: Endpoint, Bucket, Region, Access Key, Secret Key (Secret Key thường chỉ hiện 1 lần).

## 2. Tạo khoá mã hoá `FILES_ENC_KEY`

```sh
openssl rand -base64 32
```

Phải **cất bản sao ngoài VPS** (Drive Chủ tịch / trình quản lý mật khẩu) trước khi làm tiếp. Mất khoá này là mất toàn bộ tệp trên S3.

## 3. Điền `env/Timori-Quan-tri-tai-chinh/.env`

```
S3_ENDPOINT=https://...        # không có tên bucket, không có "/" ở cuối
S3_BUCKET=...
S3_REGION=us-east-1            # theo nhà cung cấp, không ghi thì để us-east-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_PREFIX=qttc/
FILES_ENC_KEY=<chuỗi ở bước 2>
FILES_ENC_KEYS_OLD=
```

## 4. Deploy cấu hình lên VPS

```sh
rsync -az env/ $VPS:$D/env/ && ssh $VPS "chmod -R go-rwx $D/env"
ssh $VPS "cd $D && ./scripts/auto-backup-timori.sh && ./Timori-Quan-tri-tai-chinh/scripts/deploy.sh"
ssh $VPS "$F status"           # dòng đầu phải là: mode: s3
```

App không lên được thì xem log: `ssh $VPS "docker logs --tail 30 timori_qttc_app"` (cấu hình S3 sai sẽ báo rõ ở đây).

Từ đây **tệp mới upload sẽ lên S3**, tệp cũ vẫn nằm trong CSDL và vẫn tải được.

## 5. Thử với tệp mới

Upload 1 tệp trên app, tải lại xem có đúng không. Vào console nhà cung cấp phải thấy object `qttc/.../xxx.enc`.

## 6. Migrate tệp cũ

```sh
ssh $VPS "cd $D && ./scripts/auto-backup-timori.sh"   # sao lưu trước khi migrate
ssh $VPS "$F migrate --limit 5"                       # chuyển thử 5 tệp
ssh $VPS "$F verify"                                  # phải ra: … – 0 lỗi
```

Mở vài chứng từ hoặc hợp đồng có tệp vừa chuyển, tải về kiểm tra. Ổn thì chuyển hết:

```sh
ssh $VPS "$F migrate"
```

Nếu nhiều tệp, chạy nền để khỏi đứt SSH giữa chừng, rồi xem tiến độ:

```sh
ssh $VPS "nohup $F migrate > /root/migrate-s3.log 2>&1 &"
ssh $VPS "tail -3 /root/migrate-s3.log"
```

Đứt giữa chừng thì chạy lại `migrate`, lệnh sẽ làm tiếp phần còn lại.

## 7. Kiểm tra cuối

```sh
ssh $VPS "$F verify && $F status"
```

Phải ra `0 lỗi`, và cả 3 bảng đều có `in_db: 0`.

---

## Sau khi chuyển

- **Từ giờ không được xoá các dòng `S3_*` và `FILES_ENC_KEY` khỏi `.env`.** Thiếu chúng thì app không đọc được tệp nữa.
- Bản sao lưu CSDL hằng đêm **không còn chứa nội dung tệp**. Nội dung được bảo vệ bằng versioning của bucket và `FILES_ENC_KEY`.
- Định kỳ, cho đến khi đưa vào `auto-backup-timori.sh`:
  - `ssh $VPS "$F purge --days 30"`: xoá hẳn trên S3 những tệp đã bị xoá trong app quá 30 ngày.
  - `ssh $VPS "$F verify"`: kiểm tra toàn vẹn, mỗi tháng một lần.
