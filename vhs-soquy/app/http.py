"""Tiện ích HTTP: lỗi chuẩn, đọc JSON, xác thực người dùng."""
import datetime as dt
import json

from starlette.responses import JSONResponse

from .db import get_db
from .security import read_token


class ApiError(Exception):
    def __init__(self, status: int, message: str, errors=None):
        self.status, self.message, self.errors = status, message, errors or {}


def ok(data=None, status=200):
    return JSONResponse(data if data is not None else {'ok': True}, status_code=status)


async def body(request):
    try:
        raw = await request.body()
        return json.loads(raw or b'{}')
    except Exception:
        raise ApiError(400, 'Dữ liệu gửi lên không hợp lệ')


def now_iso():
    return dt.datetime.now().isoformat(timespec='seconds')


def today():
    return dt.date.today().isoformat()


def current_user(request, db=None):
    """Trả về user (dict) kèm danh sách company_ids; báo 401 nếu chưa đăng nhập."""
    auth = request.headers.get('authorization', '')
    uid = read_token(auth[7:]) if auth.lower().startswith('bearer ') else None
    if not uid:
        raise ApiError(401, 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại')

    def load(d):
        u = d.one('SELECT id, username, full_name, role, permissions, active FROM users WHERE id=?', [uid])
        if not u or not u['active']:
            raise ApiError(401, 'Tài khoản không tồn tại hoặc đã bị khóa')
        u['perms'] = set(p for p in (u.pop('permissions') or '').split(',') if p)
        if u['role'] == 'admin':
            u['company_ids'] = [r['id'] for r in d.all('SELECT id FROM companies')]
        else:
            u['company_ids'] = [r['company_id'] for r in d.all('SELECT company_id FROM user_companies WHERE user_id=?', [uid])]
        return u

    if db is not None:
        return load(db)
    with get_db() as d:
        return load(d)


def q_int(request, name, default=None):
    v = request.query_params.get(name)
    try:
        return int(v) if v not in (None, '') else default
    except ValueError:
        raise ApiError(400, f'Tham số {name} không hợp lệ')


def q_str(request, name, default=None):
    v = request.query_params.get(name)
    return v if v not in (None, '') else default
