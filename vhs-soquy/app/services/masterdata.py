"""Dữ liệu khai báo (danh mục): mọi tài khoản được thêm / sửa / xóa khi còn ở trạng thái Nháp.
Bấm "Khóa (Submit)" thì không sửa / xóa được nữa – chỉ Admin mở khóa lại được."""
from ..http import ApiError, now_iso
from ..modules.base import Field, to_int
from ..permissions import is_admin, require

MASTER = {
    'company_groups': dict(title='Nhóm công ty', fields=[
        Field('name', 'Tên nhóm', 'text', True, list=True), Field('field', 'Lĩnh vực', 'text', list=True, width=2),
        Field('note', 'Ghi chú', 'text', list=True)]),
    'companies': dict(title='Công ty', fields=[
        Field('code', 'Mã công ty', 'text', True, list=True), Field('name', 'Tên công ty', 'text', True, list=True, width=2),
        Field('group_id', 'Nhóm', 'ref', list=True, source='company_groups'),
        Field('role', 'Vai trò', 'select', list=True, options=['Công ty mẹ nhóm', 'Công ty thành viên', 'Công ty con', 'Công ty độc lập']),
        Field('status', 'Trạng thái', 'select', True, list=True, options=['active', 'inactive']),
        Field('note', 'Ghi chú', 'text')]),
    'banks': dict(title='Ngân hàng', fields=[
        Field('code', 'Mã NH', 'text', True, list=True), Field('name', 'Tên ngân hàng', 'text', True, list=True, width=2),
        Field('note', 'Ghi chú', 'text', list=True)]),
    'accounts': dict(title='Tài khoản NH & quỹ tiền mặt', fields=[
        Field('code', 'Mã TK', 'text', True, list=True, help='VD: MB-TPE, TM-TPE (quỹ tiền mặt)'),
        Field('company_id', 'Công ty', 'ref', True, list=True, source='companies'),
        Field('kind', 'Loại quỹ', 'select', True, list=True, options=['bank', 'cash']),
        Field('bank_id', 'Ngân hàng', 'ref', list=True, source='banks', help='Bỏ trống nếu là quỹ tiền mặt'),
        Field('number', 'Số tài khoản', 'text', list=True), Field('branch', 'Chi nhánh / mô tả', 'text'),
        Field('holder', 'Người giữ quỹ (thủ quỹ)', 'text', list=True),
        Field('opening_balance', 'Số dư đầu', 'money', list=True), Field('opening_date', 'Ngày số dư đầu', 'date'),
        Field('min_balance', 'Tồn tối thiểu', 'money'),
        Field('status', 'Trạng thái', 'select', True, list=True, options=['active', 'locked', 'closed']),
        Field('note', 'Ghi chú', 'text')]),
    'categories': dict(title='Hạng mục thu chi', fields=[
        Field('name', 'Hạng mục', 'text', True, list=True, width=2),
        Field('nature', 'Tính chất', 'select', True, list=True, options=['operating', 'financing', 'internal']),
        Field('note', 'Ghi chú', 'text', list=True)]),
    'partners': dict(title='Đối tác & nhân viên', fields=[
        Field('name', 'Tên', 'text', True, list=True, width=2),
        Field('type', 'Loại', 'select', True, list=True, options=['supplier', 'customer', 'employee', 'other']),
        Field('company_id', 'Công ty', 'ref', list=True, source='companies'),
        Field('tax_code', 'MST / CCCD', 'text', list=True), Field('bank_account', 'STK – Ngân hàng', 'text'),
        Field('note', 'Ghi chú', 'text')]),
}
LABELS = {'active': 'Hoạt động', 'inactive': 'Ngừng hoạt động', 'locked': 'Tạm khóa', 'closed': 'Đã đóng', 'bank': 'Ngân hàng',
          'cash': 'Tiền mặt', 'operating': 'Hoạt động KD', 'financing': 'Tài chính', 'internal': 'Nội bộ',
          'supplier': 'Nhà cung cấp', 'customer': 'Khách hàng', 'employee': 'Nhân viên', 'other': 'Khác'}
ORDER = ['companies', 'company_groups', 'banks', 'accounts', 'categories', 'partners']


def spec(table):
    s = MASTER.get(table)
    if not s:
        raise ApiError(404, 'Danh mục không tồn tại')
    return s


def meta():
    return [{'key': t, 'title': MASTER[t]['title'], 'fields': [f.meta() for f in MASTER[t]['fields']]} for t in ORDER]


def list_rows(db, table):
    spec(table)
    rows = db.all(f'SELECT t.*, u.full_name AS created_by_name FROM {table} t LEFT JOIN users u ON u.id=t.created_by ORDER BY t.id')
    return rows


def options(db):
    """Danh sách chọn cho form (gọn, dùng chung toàn hệ thống)."""
    return {
        'companies': db.all('SELECT id, code, name, group_id, status FROM companies ORDER BY id'),
        'company_groups': db.all('SELECT id, name FROM company_groups ORDER BY id'),
        'banks': db.all('SELECT id, code, name FROM banks ORDER BY id'),
        'accounts': db.all('SELECT a.id, a.code, a.company_id, a.kind, a.status, a.holder, c.code AS company_code FROM accounts a '
                           'JOIN companies c ON c.id=a.company_id ORDER BY c.id, a.kind, a.code'),
        'categories': db.all('SELECT id, name, nature FROM categories ORDER BY id'),
        'partners': db.all('SELECT id, name, type, company_id FROM partners ORDER BY name'),
    }


def _clean(table, data):
    rec, err = {}, {}
    for f in spec(table)['fields']:
        v = data.get(f.name)
        if f.type in ('money',):
            v = to_int(v)
        elif f.type == 'ref':
            v = to_int(v)
        elif isinstance(v, str):
            v = v.strip() or None
        if f.required and v in (None, ''):
            err[f.name] = 'Bắt buộc nhập'
        if f.type == 'select' and v and v not in f.options:
            err[f.name] = 'Giá trị không hợp lệ'
        rec[f.name] = v
    if table == 'accounts':
        if rec.get('kind') == 'bank' and not rec.get('bank_id'):
            err['bank_id'] = 'TK ngân hàng phải chọn ngân hàng'
        if rec.get('kind') == 'cash':
            rec['bank_id'] = None
        rec['opening_balance'] = rec.get('opening_balance') or 0
    if err:
        raise ApiError(422, 'Dữ liệu chưa hợp lệ', err)
    return rec


def _integrity(fn):
    try:
        return fn()
    except ApiError:
        raise
    except Exception as e:
        msg = str(e).lower()
        if 'unique' in msg or 'duplicate' in msg:
            raise ApiError(409, 'Mã / tên này đã tồn tại')
        if 'foreign key' in msg or 'violates' in msg:
            raise ApiError(409, 'Không thể xóa / sửa: dữ liệu đang được sử dụng ở chứng từ hoặc danh mục khác')
        raise


def create(db, user, table, data):
    rec = _clean(table, data)
    rec.update(locked=0, created_by=user['id'], created_at=now_iso())
    return _integrity(lambda: db.insert(table, rec))


def _get(db, table, id_):
    r = db.one(f'SELECT * FROM {table} WHERE id=?', [id_])
    if not r:
        raise ApiError(404, 'Không tìm thấy')
    return r


def update(db, user, table, id_, data):
    r = _get(db, table, id_)
    require(not r['locked'] or is_admin(user), 'Dữ liệu đã khóa (Submit) – chỉ Admin tập đoàn mở khóa được')
    rec = _clean(table, data)
    _integrity(lambda: db.update(table, id_, rec))


def delete(db, user, table, id_):
    r = _get(db, table, id_)
    require(not r['locked'] or is_admin(user), 'Dữ liệu đã khóa (Submit) – chỉ Admin tập đoàn mở khóa được')
    _integrity(lambda: db.execute(f'DELETE FROM {table} WHERE id=?', [id_]))


def lock(db, user, table, ids):
    spec(table)
    n = 0
    for id_ in ids:
        r = _get(db, table, id_)
        if not r['locked'] and (r['created_by'] == user['id'] or is_admin(user)):
            db.update(table, id_, {'locked': 1})
            n += 1
    return n


def unlock(db, user, table, ids):
    require(is_admin(user), 'Chỉ Admin tập đoàn được mở khóa dữ liệu khai báo')
    spec(table)
    for id_ in ids:
        db.update(table, id_, {'locked': 0})
    return len(ids)
