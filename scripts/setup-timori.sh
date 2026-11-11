#!/bin/sh
# Tạo tài khoản dùng chung cho Quản trị tài chính + Kế toán (kế toán đăng nhập chung qua Quản trị tài chính).
# Dùng: ./scripts/setup-timori.sh [tên đăng nhập] [mật khẩu] [họ tên] [vai trò]
#   mặc định: chairman / 123456 / Chủ tịch / chairman.
# Ghi thẳng vào CSDL qua code của app (không cần mật khẩu admin). Tài khoản đã có → đặt lại mật khẩu, vai trò, mở khoá.
# Cần 2 stack Timori đang chạy (./scripts/deploy.sh hoặc ./scripts/up.sh).
set -e
U=${1:-chairman}; P=${2:-123456}; N=${3:-Chủ tịch}; R=${4:-chairman}

docker exec -i -w /app -e U="$U" -e P="$P" -e N="$N" -e R="$R" timori_qttc_app python - <<'EOF'
import json, os, urllib.request, urllib.error
from app.db import get_db
from app.http import now_iso
from app.security import hash_password

U, P, N, R = (os.environ[k] for k in 'UPNR')
with get_db() as db:
    uid = db.scalar('SELECT id FROM users WHERE username=?', [U])
    h = hash_password(P)
    if uid:
        db.update('users', uid, dict(password_hash=h, role=R, active=1))
        print(f'Quản trị tài chính: {U} đã có → đặt lại mật khẩu, vai trò {R}')
    else:
        db.insert('users', dict(username=U, full_name=N, role=R, password_hash=h, permissions='', active=1, created_at=now_iso()))
        print(f'Quản trị tài chính: đã tạo {U} ({R})')

def login(url):
    req = urllib.request.Request(url, json.dumps({'username': U, 'password': P}).encode(), {'Content-Type': 'application/json'})
    try:
        return urllib.request.urlopen(req).status
    except urllib.error.HTTPError as e:
        return e.code

print('Đăng nhập Quản trị tài chính:', login('http://127.0.0.1:8000/api/auth/login'))
print('Đăng nhập Kế toán:', login('http://ketoan:8770/api/login'))
EOF
