"""Chứng từ nghiệp vụ: lập – sửa – gửi duyệt – duyệt nhiều cấp – ghi sổ – đề nghị mở lại – mở lại – hủy.

Trạng thái:
  draft (Nháp) → submitted (Chờ duyệt cấp 1: KTT / Kế toán duyệt lương)
  → l1_approved (Chờ GĐ công ty trụ cột – Admin 2)          [bỏ qua nếu nhóm chưa có tài khoản Admin 2]
  → dir_approved (Chờ Admin tập đoàn duyệt cuối) → posted (Đã duyệt & ghi sổ);  cancelled (Đã hủy).
Chỉ Admin tập đoàn được mở lại (về Nháp) hoặc hủy.
"""
from ..http import ApiError, now_iso
from ..modules import REGISTRY
from ..modules.base import Ctx
from ..permissions import (can_create, can_l1, can_view_module, in_scope, is_admin, is_director, require, require_scope)

STATUS = {'draft': 'Nháp', 'submitted': 'Chờ duyệt cấp 1', 'l1_approved': 'Chờ GĐ công ty trụ cột',
          'dir_approved': 'Chờ Admin duyệt cuối', 'posted': 'Đã duyệt & ghi sổ', 'cancelled': 'Đã hủy'}
PENDING = ('submitted', 'l1_approved', 'dir_approved')
COMMON = ['id', 'company_id', 'doc_date', 'status', 'reopen_requested', 'reopen_note', 'created_by', 'created_at', 'updated_at',
          'submitted_at', 'l1_by', 'l1_at', 'dir_by', 'dir_at', 'l2_by', 'l2_at', 'posted_at']


def cols(m):
    return [f.name for f in m.fields if not f.computed and f.name not in ('company_id', 'doc_date')]


def log(db, m, doc_id, action, user, note=None):
    db.insert('doc_events', dict(module=m.key, doc_id=doc_id, action=action, user_id=user['id'], user_name=user['full_name'],
                                 note=note, at=now_iso()))


def load(db, m, doc_id):
    d = db.one(f'SELECT * FROM {m.table} WHERE id=?', [doc_id])
    if not d:
        raise ApiError(404, 'Chứng từ không tồn tại')
    return d


def decorate(m, d, ctx, users=None):
    d['amount_view'] = m.amount(d)
    d['direction'] = m.direction(d)
    d['summary'] = m.summary(d)
    d['needs_director'] = d.get('company_id') in ctx.director_companies
    d['status_label'] = STATUS.get(d['status'], d['status'])
    if d['status'] == 'l1_approved' and not d['needs_director']:
        d['status_label'] = STATUS['dir_approved']          # nhóm chưa có Admin 2 → chờ Admin tập đoàn
    for f in m.fields:
        if f.type == 'account' and d.get(f.name):
            d[f.name + '_code'] = ctx.accounts.get(d[f.name], {}).get('code')
        if f.type == 'category' and d.get(f.name):
            d[f.name + '_name'] = ctx.cat_by_id.get(d[f.name], {}).get('name')
        if f.computed:
            d[f.name] = m.amount(d)
    if users is not None:
        for k in ('created_by', 'l1_by', 'dir_by', 'l2_by'):
            if d.get(k):
                d[k + '_name'] = users.get(d[k])
    return d


def user_names(db):
    return {r['id']: r['full_name'] for r in db.all('SELECT id, full_name FROM users')}


def scope_sql(user, alias='d'):
    if is_admin(user):
        return '', []
    ids = user['company_ids'] or [-1]
    return f' AND {alias}.company_id IN ({",".join("?" * len(ids))})', list(ids)


# ---------------------------------------------------------------- danh sách
def list_docs(db, user, m, status=None, company_id=None, date_from=None, date_to=None, q=None, mine=False,
              reopen=False, limit=200, offset=0):
    require(can_view_module(user, m), 'Bạn không có quyền xem nghiệp vụ này')
    s, p = scope_sql(user)
    where, params = ' WHERE 1=1' + s, list(p)
    if company_id:
        where += ' AND d.company_id=?'
        params.append(company_id)
    if date_from:
        where += ' AND d.doc_date>=?'
        params.append(date_from)
    if date_to:
        where += ' AND d.doc_date<=?'
        params.append(date_to)
    if mine:
        where += ' AND d.created_by=?'
        params.append(user['id'])
    if q:
        text_cols = [f.name for f in m.fields if f.type in ('text', 'textarea', 'partner', 'select')]
        conds = [f'LOWER(COALESCE(d.{c}, \'\')) LIKE ?' for c in text_cols]
        params += [f'%{q.lower()}%'] * len(conds)
        if q.strip().lstrip('#').isdigit():
            conds.append('d.id=?')
            params.append(int(q.strip().lstrip('#')))
        where += f' AND ({" OR ".join(conds)})'
    # đếm theo trạng thái (theo các bộ lọc khác, không tính bộ lọc trạng thái)
    counts = {r['status']: r['n'] for r in db.all(f'SELECT d.status, COUNT(*) AS n FROM {m.table} d{where} GROUP BY d.status', params)}
    counts['reopen'] = db.scalar(f'SELECT COUNT(*) FROM {m.table} d{where} AND d.reopen_requested=1', params)
    if status:
        where += ' AND d.status=?'
        params.append(status)
    if reopen:
        where += ' AND d.reopen_requested=1'
    rows = db.all(f'SELECT d.*, c.code AS company_code FROM {m.table} d LEFT JOIN companies c ON c.id=d.company_id'
                  f'{where} ORDER BY d.doc_date DESC, d.id DESC LIMIT ? OFFSET ?', params + [limit, offset])
    total = db.scalar(f'SELECT COUNT(*) FROM {m.table} d{where}', params)
    ctx, names = Ctx(db), user_names(db)
    out = [decorate(m, r, ctx, names) for r in rows]
    for r in out:
        r['actions'] = actions(user, m, r)
    return {'rows': out, 'total': total, 'counts': counts}


def actions(user, m, d):
    """Các nút thao tác hợp lệ cho người dùng hiện tại."""
    st, a = d['status'], []
    owner = d['created_by'] == user['id']
    if st == 'draft' and (owner or is_admin(user)) and (can_create(user, m)):
        a += ['edit', 'delete', 'submit']
    if st == 'submitted' and can_l1(user, m) and in_scope(user, d['company_id']) and not owner:
        a += ['approve']
    if st == 'l1_approved' and d['needs_director'] and is_director(user) and in_scope(user, d['company_id']) and not owner:
        a += ['approve']
    if is_admin(user) and (st == 'dir_approved' or (st == 'l1_approved' and not d['needs_director'])):
        a += ['approve']
    if st in PENDING + ('posted',) and not d['reopen_requested'] and not is_admin(user):
        if owner or (in_scope(user, d['company_id']) and (can_l1(user, m) or is_director(user))):
            a += ['request_reopen']
    if is_admin(user) and st in PENDING + ('posted', 'cancelled'):
        a += ['reopen']
    if is_admin(user) and st in ('draft',) + PENDING + ('posted',):
        a += ['cancel']
    return a


def get_doc(db, user, m, doc_id):
    require(can_view_module(user, m))
    d = load(db, m, doc_id)
    require_scope(user, d['company_id'])
    ctx = Ctx(db)
    d = decorate(m, d, ctx, user_names(db))
    d['actions'] = actions(user, m, d)
    d['events'] = db.all('SELECT action, user_name, note, at FROM doc_events WHERE module=? AND doc_id=? ORDER BY id', [m.key, doc_id])
    d['ledger'] = db.all('SELECT e.txn_date, a.code AS account_code, e.amount_in, e.amount_out, e.description FROM ledger_entries e '
                         'JOIN accounts a ON a.id=e.account_id WHERE e.module=? AND e.doc_id=? ORDER BY e.line_no', [m.key, doc_id])
    d['preview_lines'] = []
    if d['status'] != 'posted' and not m.validate(d, ctx):
        d['preview_lines'] = [dict(l, account_code=ctx.accounts[l['account_id']]['code']) for l in m.lines(d, ctx)]
    return d


# ---------------------------------------------------------------- lập / sửa / xóa
def _prepare(db, user, m, data):
    ctx = Ctx(db)
    doc = m.normalize(data)
    errors = m.validate(doc, ctx)
    company = m.company_of(doc, ctx)
    if not errors and not company:
        errors['_'] = 'Không xác định được công ty của chứng từ'
    if errors:
        raise ApiError(422, 'Dữ liệu chưa hợp lệ, vui lòng kiểm tra các ô báo đỏ', errors)
    require_scope(user, company)
    doc['company_id'] = company
    return doc


def create(db, user, m, data):
    require(can_create(user, m), 'Bạn không có quyền lập chứng từ nghiệp vụ này')
    doc = _prepare(db, user, m, data)
    rec = {c: doc.get(c) for c in cols(m)}
    rec.update(company_id=doc['company_id'], doc_date=doc.get('doc_date'), status='draft', created_by=user['id'],
               created_at=now_iso(), updated_at=now_iso())
    new_id = db.insert(m.table, rec)
    log(db, m, new_id, 'Lập chứng từ', user)
    return new_id


def update(db, user, m, doc_id, data):
    d = load(db, m, doc_id)
    require(d['status'] == 'draft', 'Chỉ sửa được chứng từ ở trạng thái Nháp (đã gửi duyệt cần Admin mở lại)')
    require(d['created_by'] == user['id'] or is_admin(user), 'Chỉ người lập hoặc Admin được sửa')
    doc = _prepare(db, user, m, data)
    rec = {c: doc.get(c) for c in cols(m)}
    rec.update(company_id=doc['company_id'], doc_date=doc.get('doc_date'), updated_at=now_iso())
    db.update(m.table, doc_id, rec)
    log(db, m, doc_id, 'Sửa chứng từ', user)


def delete(db, user, m, doc_id):
    d = load(db, m, doc_id)
    require(d['status'] == 'draft', 'Chỉ xóa được chứng từ Nháp')
    require(d['created_by'] == user['id'] or is_admin(user), 'Chỉ người lập hoặc Admin được xóa')
    db.execute(f'DELETE FROM {m.table} WHERE id=?', [doc_id])
    log(db, m, doc_id, 'Xóa chứng từ', user)


# ---------------------------------------------------------------- quy trình
def submit(db, user, m, doc_id):
    d = load(db, m, doc_id)
    require(d['status'] == 'draft', 'Chứng từ không ở trạng thái Nháp')
    require(d['created_by'] == user['id'] or is_admin(user), 'Chỉ người lập được gửi duyệt')
    errors = m.validate(d, Ctx(db))
    if errors:
        raise ApiError(422, 'Chứng từ còn lỗi, mở Sửa để kiểm tra', errors)
    db.update(m.table, doc_id, dict(status='submitted', submitted_at=now_iso(), reopen_requested=0, reopen_note=None))
    log(db, m, doc_id, 'Gửi duyệt', user)


def approve(db, user, m, doc_id, note=None):
    d = load(db, m, doc_id)
    if d['status'] == 'submitted':
        require(can_l1(user, m), f'Cần {m.l1_label} duyệt cấp 1')
        require_scope(user, d['company_id'])
        require(d['created_by'] != user['id'], 'Người lập không được tự duyệt chứng từ của mình')
        db.update(m.table, doc_id, dict(status='l1_approved', l1_by=user['id'], l1_at=now_iso()))
        log(db, m, doc_id, f'Duyệt cấp 1 ({m.l1_label})', user, note)
        return 'l1_approved'
    ctx = Ctx(db)
    if d['status'] == 'l1_approved' and d['company_id'] in ctx.director_companies:
        require(is_director(user), 'Chờ Giám đốc công ty trụ cột (Admin 2) duyệt cấp 2')
        require_scope(user, d['company_id'])
        require(d['created_by'] != user['id'], 'Người lập không được tự duyệt chứng từ của mình')
        db.update(m.table, doc_id, dict(status='dir_approved', dir_by=user['id'], dir_at=now_iso()))
        log(db, m, doc_id, 'Duyệt cấp 2 (GĐ công ty trụ cột)', user, note)
        return 'dir_approved'
    if d['status'] in ('l1_approved', 'dir_approved'):
        require(is_admin(user), 'Chỉ Admin tập đoàn được duyệt cuối')
        errors = m.validate(d, ctx)
        if errors:
            raise ApiError(422, 'Chứng từ không còn hợp lệ (TK bị khóa / dữ liệu khai báo thay đổi) – hãy mở lại để sửa', errors)
        post(db, m, d, ctx)
        db.update(m.table, doc_id, dict(status='posted', l2_by=user['id'], l2_at=now_iso(), posted_at=now_iso(),
                                        reopen_requested=0))
        log(db, m, doc_id, 'Admin tập đoàn duyệt cuối – đã ghi sổ', user, note)
        return 'posted'
    raise ApiError(409, 'Chứng từ không ở trạng thái chờ duyệt')


def post(db, m, d, ctx):
    db.execute('DELETE FROM ledger_entries WHERE module=? AND doc_id=?', [m.key, d['id']])
    for i, l in enumerate(m.lines(d, ctx), 1):
        db.insert('ledger_entries', dict(module=m.key, doc_id=d['id'], line_no=i, txn_date=d['doc_date'],
                                         account_id=l['account_id'], company_id=ctx.accounts[l['account_id']]['company_id'],
                                         amount_in=l['amount_in'], amount_out=l['amount_out'], category_id=l['category_id'],
                                         counterparty=l['counterparty'], description=l['description'], doc_no=d.get('doc_no'),
                                         posted_at=now_iso()))


def request_reopen(db, user, m, doc_id, note):
    d = load(db, m, doc_id)
    require('request_reopen' in actions(user, m, d) or is_admin(user), 'Bạn không thể đề nghị mở lại chứng từ này')
    if not note:
        raise ApiError(422, 'Vui lòng ghi lý do / nội dung sai cần sửa', {'note': 'Bắt buộc'})
    db.update(m.table, doc_id, dict(reopen_requested=1, reopen_note=note))
    log(db, m, doc_id, 'Đề nghị mở lại', user, note)


def reopen(db, user, m, doc_id, note=None):
    require(is_admin(user), 'Chỉ Admin tập đoàn được mở lại chứng từ')
    d = load(db, m, doc_id)
    require(d['status'] != 'draft', 'Chứng từ đang là Nháp')
    db.execute('DELETE FROM ledger_entries WHERE module=? AND doc_id=?', [m.key, doc_id])
    db.update(m.table, doc_id, dict(status='draft', reopen_requested=0, l1_by=None, l1_at=None, dir_by=None, dir_at=None,
                                    l2_by=None, l2_at=None,
                                    posted_at=None, submitted_at=None))
    log(db, m, doc_id, 'Admin mở lại cho sửa' + (' (đã hủy bút toán)' if d['status'] == 'posted' else ''), user, note)


def cancel(db, user, m, doc_id, note=None):
    require(is_admin(user), 'Chỉ Admin tập đoàn được hủy chứng từ')
    d = load(db, m, doc_id)
    require(d['status'] != 'cancelled', 'Chứng từ đã hủy')
    db.execute('DELETE FROM ledger_entries WHERE module=? AND doc_id=?', [m.key, doc_id])
    db.update(m.table, doc_id, dict(status='cancelled', reopen_requested=0, posted_at=None))
    log(db, m, doc_id, 'Admin hủy chứng từ', user, note)


ACTIONS = {'submit': submit, 'approve': approve, 'request_reopen': request_reopen, 'reopen': reopen, 'cancel': cancel}


def run_action(db, user, m, doc_id, action, note=None):
    fn = ACTIONS.get(action)
    if not fn:
        raise ApiError(400, 'Thao tác không hợp lệ')
    if action == 'submit':
        return fn(db, user, m, doc_id)
    return fn(db, user, m, doc_id, note)


# ---------------------------------------------------------------- hộp duyệt
def inbox(db, user):
    """Chứng từ đang chờ người dùng hiện tại xử lý."""
    out = []
    ctx, names = Ctx(db), user_names(db)
    scope_s, scope_p = scope_sql(user)
    for m in REGISTRY.values():
        conds, cp = [], []
        if can_l1(user, m):
            conds.append("(d.status='submitted' AND d.created_by<>?)")
            cp.append(user['id'])
        dir_cos = sorted(ctx.director_companies) or [-1]
        marks = ','.join('?' * len(dir_cos))
        if is_director(user):
            conds.append(f"(d.status='l1_approved' AND d.company_id IN ({marks}) AND d.created_by<>?)")
            cp += dir_cos + [user['id']]
        if is_admin(user):
            conds += ["d.status='dir_approved'", f"(d.status='l1_approved' AND d.company_id NOT IN ({marks}))",
                      "d.reopen_requested=1"]
            cp += dir_cos
        if not conds:
            continue
        rows = db.all(f'SELECT d.*, c.code AS company_code FROM {m.table} d LEFT JOIN companies c ON c.id=d.company_id '
                      f'WHERE ({" OR ".join(conds)}){scope_s} ORDER BY d.doc_date, d.id LIMIT 500', cp + scope_p)
        for r in rows:
            r = decorate(m, r, ctx, names)
            r['module'], r['module_title'] = m.key, m.title
            r['actions'] = actions(user, m, r)
            out.append(r)
    return out


def pending_counts(db, user):
    return {'inbox': len(inbox(db, user))}
