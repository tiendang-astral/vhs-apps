#!/bin/sh
# Tạo tài khoản dùng chung cho Quản trị tài chính + Kế toán (kế toán đăng nhập chung qua Quản trị tài chính).
# Dùng: ./scripts/setup-timori.sh [tên đăng nhập] [mật khẩu] [họ tên] [vai trò]
#   mặc định: chairman / 123456 / Chủ tịch / chairman. Tài khoản đã có (đăng nhập được) thì bỏ qua.
# Cần 2 stack Timori đang chạy (./scripts/deploy.sh hoặc ./scripts/up.sh).
# Đăng nhập bằng admin có sẵn trong container (ADMIN_USERNAME / ADMIN_PASSWORD), không in mật khẩu ra màn hình.
set -e
U=${1:-chairman}; P=${2:-123456}; N=${3:-Chủ tịch}; R=${4:-chairman}

docker exec -i -e U="$U" -e P="$P" -e N="$N" -e R="$R" timori_qttc_app python - <<'EOF'
import json, os, urllib.request, urllib.error

def call(url, data, token=None):
    req = urllib.request.Request(url, json.dumps(data).encode(), {'Content-Type': 'application/json'})
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b'{}')

Q = 'http://127.0.0.1:8000'
U, P, N, R = (os.environ[k] for k in 'UPNR')

if call(Q + '/api/auth/login', {'username': U, 'password': P})[0] == 200:
    print(f'Quản trị tài chính: {U} đã có, đăng nhập được')
else:
    st, r = call(Q + '/api/auth/login', {'username': os.environ.get('ADMIN_USERNAME', 'admin'), 'password': os.environ.get('ADMIN_PASSWORD', '')})
    if st != 200:
        raise SystemExit('Không đăng nhập được admin (mật khẩu admin đã đổi trong app, khác ADMIN_PASSWORD trong env?)')
    st, r = call(Q + '/api/users', {'username': U, 'password': P, 'full_name': N, 'role': R}, r['token'])
    if st >= 300:
        raise SystemExit(f'Tạo {U} lỗi {st}: {r}')
    print(f'Quản trị tài chính: đã tạo {U} ({R})')

st, r = call('http://ketoan:8770/api/login', {'username': U, 'password': P})
print('Kế toán:', 'đăng nhập được' if st == 200 else f'lỗi {st}: {r}')
EOF
