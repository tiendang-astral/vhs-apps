"""Quản trị tài khoản người dùng (chỉ Admin)."""
from ..http import ApiError, now_iso
from ..permissions import PERMISSIONS, ROLES, is_admin, require
from ..security import hash_password, verify_password

PERM_KEYS = {k for k, _ in PERMISSIONS}


def list_users(db, user):
    require(is_admin(user), 'Chỉ Admin tập đoàn quản lý tài khoản')
    rows = db.all('SELECT id, username, full_name, role, permissions, active, created_at FROM users ORDER BY id')
    links = db.all('SELECT user_id, company_id FROM user_companies')
    for r in rows:
        r['permissions'] = [p for p in (r['permissions'] or '').split(',') if p]
        r['company_ids'] = [l['company_id'] for l in links if l['user_id'] == r['id']]
        r['role_label'] = ROLES.get(r['role'], r['role'])
    return rows


def _clean(data, creating):
    err = {}
    username = (data.get('username') or '').strip().lower()
    full_name = (data.get('full_name') or '').strip()
    role = data.get('role')
    pw = data.get('password') or ''
    if not username:
        err['username'] = 'Bắt buộc'
    if not full_name:
        err['full_name'] = 'Bắt buộc'
    if role not in ROLES:
        err['role'] = 'Vai trò không hợp lệ'
    if (creating or pw) and len(pw) < 6:
        err['password'] = 'Mật khẩu tối thiểu 6 ký tự'
    perms = [p for p in (data.get('permissions') or []) if p in PERM_KEYS] if role == 'staff' else []
    companies = [int(c) for c in (data.get('company_ids') or [])]
    if role in ('staff', 'chief_accountant', 'director') and not companies:
        err['company_ids'] = 'Chọn ít nhất 1 công ty phụ trách'
    if err:
        raise ApiError(422, 'Dữ liệu chưa hợp lệ', err)
    return dict(username=username, full_name=full_name, role=role, permissions=','.join(perms),
                active=1 if data.get('active', True) else 0), pw, companies


def _set_companies(db, uid, companies):
    db.execute('DELETE FROM user_companies WHERE user_id=?', [uid])
    db.executemany('INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)', [(uid, c) for c in companies])


def create_user(db, user, data):
    require(is_admin(user), 'Chỉ Admin tập đoàn tạo tài khoản')
    rec, pw, companies = _clean(data, True)
    if db.scalar('SELECT COUNT(*) FROM users WHERE username=?', [rec['username']]):
        raise ApiError(409, 'Tên đăng nhập đã tồn tại', {'username': 'Đã tồn tại'})
    rec.update(password_hash=hash_password(pw), created_at=now_iso())
    uid = db.insert('users', rec)
    _set_companies(db, uid, companies)
    return uid


def update_user(db, user, uid, data):
    require(is_admin(user), 'Chỉ Admin tập đoàn sửa tài khoản')
    rec, pw, companies = _clean(data, False)
    if uid == user['id'] and rec['role'] != 'admin':
        raise ApiError(400, 'Không thể tự hạ quyền tài khoản admin đang đăng nhập')
    if db.scalar('SELECT COUNT(*) FROM users WHERE username=? AND id<>?', [rec['username'], uid]):
        raise ApiError(409, 'Tên đăng nhập đã tồn tại', {'username': 'Đã tồn tại'})
    if pw:
        rec['password_hash'] = hash_password(pw)
    db.update('users', uid, rec)
    _set_companies(db, uid, companies)


def delete_user(db, user, uid):
    require(is_admin(user), 'Chỉ Admin tập đoàn xóa tài khoản')
    if uid == user['id']:
        raise ApiError(400, 'Không thể xóa tài khoản đang đăng nhập')
    used = 0
    for t in ('doc_cashbook', 'doc_partner_payment', 'doc_payroll', 'doc_cash_fund'):
        used += db.scalar(f'SELECT COUNT(*) FROM {t} WHERE created_by=? OR l1_by=? OR l2_by=?', [uid, uid, uid])
    if used:
        db.update('users', uid, {'active': 0})       # đã có chứng từ → khóa thay vì xóa để giữ lịch sử
        return 'deactivated'
    db.execute('DELETE FROM user_companies WHERE user_id=?', [uid])
    db.execute('DELETE FROM users WHERE id=?', [uid])
    return 'deleted'


def change_password(db, user, old, new):
    row = db.one('SELECT password_hash FROM users WHERE id=?', [user['id']])
    if not verify_password(old or '', row['password_hash']):
        raise ApiError(400, 'Mật khẩu hiện tại không đúng')
    if len(new or '') < 6:
        raise ApiError(400, 'Mật khẩu mới tối thiểu 6 ký tự')
    db.update('users', user['id'], {'password_hash': hash_password(new)})
