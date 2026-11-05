"""Chứng từ nghiệp vụ: lập – sửa – gửi duyệt – duyệt theo tuyến – chi & ghi sổ – hậu kiểm – mở lại – hủy.

Luồng duyệt theo Mô hình Tài chính – Kế toán TIMORI GROUP (v06). Khi gửi duyệt, hệ thống lập TUYẾN DUYỆT cho từng chứng từ:

  chk   KTTH kiểm tra hồ sơ                       (KTTH / KTV lương với bảng lương)
  ctl   Kiểm soát cấp 1                           (CFO; giai đoạn 2: KTT nhóm cho khoản đến N, không đặc biệt)
  pre   KSNB kiểm tra trước                       (chỉ khoản trên N hoặc giao dịch đặc biệt)
  dir   Giám đốc nhóm duyệt cấp 2                 (khoản chi đến N; khoản trên N trước khi lên Chủ tịch)
  chair Chủ tịch duyệt                            (khoản trên N, giao dịch đặc biệt; nhóm chưa có Giám đốc nhóm)
  pay   Ngân quỹ chi trên ngân hàng & ghi sổ      (khoản có tiền ra; nhập số UNC)

  Khoản chi thường, đến N : chk → ctl → dir → pay
  Khoản chi trên N        : chk → ctl → pre → dir → chair → pay
  Giao dịch đặc biệt      : chk → ctl → pre → chair → (pay nếu có tiền ra)       (Giám đốc nhóm không duyệt)
  Khoản thu thường        : chk → ghi sổ
Trạng thái chứng từ = mã bước đang chờ; draft (Nháp), posted (Đã ghi sổ), cancelled (Đã hủy).
Mỗi người chỉ duyệt 1 bước của 1 chứng từ; người lập không tự duyệt. Chỉ Quản trị hệ thống mở lại / hủy.
"""
from ..config import settings
from ..http import ApiError, now_iso
from ..modules import REGISTRY
from ..modules.base import Ctx
from ..permissions import (can_check, can_create, can_view_module, in_scope, is_admin, is_global, require, require_scope)

STEPS = {
    'chk': ('KTTH kiểm tra hồ sơ', 'Chờ KTTH kiểm tra'),
    'ctl': ('Kiểm soát cấp 1 (CFO / KTT nhóm)', 'Chờ kiểm soát cấp 1'),
    'pre': ('KSNB kiểm tra trước', 'Chờ KSNB kiểm tra'),
    'dir': ('Giám đốc nhóm duyệt', 'Chờ Giám đốc nhóm'),
    'chair': ('Chủ tịch duyệt', 'Chờ Chủ tịch'),
    'pay': ('Ngân quỹ chi & ghi sổ', 'Chờ Ngân quỹ chi'),
}
STATUS = {'draft': 'Nháp', **{k: v[1] for k, v in STEPS.items()}, 'posted': 'Đã ghi sổ', 'cancelled': 'Đã hủy'}
PENDING = tuple(STEPS)
COMMON = ['id', 'company_id', 'doc_date', 'status', 'reopen_requested', 'reopen_note', 'created_by', 'created_at', 'updated_at',
          'submitted_at', 'l1_by', 'l1_at', 'dir_by', 'dir_at', 'l2_by', 'l2_at', 'posted_at']
APPROVE_LABEL = {'chk': 'Xác nhận đã kiểm tra', 'ctl': 'Kiểm soát cấp 1 – đồng ý', 'pre': 'KSNB – đồng ý',
                 'dir': 'Giám đốc nhóm duyệt', 'chair': 'Chủ tịch duyệt', 'pay': 'Xác nhận đã chi & ghi sổ'}


def threshold(ctx, company_id):
    c = ctx.companies.get(company_id) or {}
    return c.get('threshold_n') or settings.APPROVAL_THRESHOLD


def build_route(m, d, ctx):
    """Tuyến duyệt của chứng từ: (danh sách bước, ghi chú lý do)."""
    if hasattr(m, 'custom_route'):
        r = m.custom_route(d, ctx)
        if r:
            return r
    amount, direction = m.amount(d) or 0, m.direction(d)
    special = m.special(d, ctx)
    n = threshold(ctx, d.get('company_id'))
    big = amount > n
    money_out = direction in ('out', 'move')
    has_dir = 'director' in ctx.active_roles(d.get('company_id'))
    notes = []
    if special:
        route = ['chk', 'ctl', 'pre', 'chair']
        notes.append(f'Giao dịch đặc biệt: {special}')
    elif big:
        route = ['chk', 'ctl', 'pre'] + (['dir'] if has_dir else []) + ['chair']
        notes.append(f'Trên ngưỡng N ({n:,.0f} đ)'.replace(',', '.'))
    elif money_out:
        route = ['chk', 'ctl'] + (['dir'] if has_dir else ['chair'])
        if not has_dir:
            notes.append('Công ty chưa có tài khoản Giám đốc nhóm → Chủ tịch duyệt')
    else:
        route = ['chk']
    if money_out:
        route.append('pay')
    return route, '; '.join(notes) or None


def route_of(d):
    return [s for s in (d.get('route') or '').split(',') if s]


def approvals(db, m, doc_id):
    return db.all('SELECT step, user_id, user_name, note, at FROM doc_approvals WHERE module=? AND doc_id=? ORDER BY id',
                  [m.key, doc_id])


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


def _big_or_special(d):
    return bool(d.get('route_note')) and 'pre' in route_of(d)


def can_do_step(user, m, d, step, ctx=None):
    """Người dùng có quyền xử lý bước `step` của chứng từ không (chưa xét người lập / đã duyệt bước khác)."""
    r, co = user['role'], d['company_id']
    if step == 'chk':
        return can_check(user, m) and in_scope(user, co)
    if step == 'ctl':
        if r == 'cfo':
            return True
        return r == 'group_chief' and in_scope(user, co) and not _big_or_special(d)
    if step == 'pre':
        return r == 'auditor'
    if step == 'dir':
        return r == 'director' and in_scope(user, co)
    if step == 'chair':
        return r == 'chairman'
    if step == 'pay':
        return r == 'treasury'
    return False


def decorate(m, d, ctx, users=None, apps=None):
    d['amount_view'] = m.amount(d)
    d['direction'] = m.direction(d)
    d['summary'] = m.summary(d)
    d['status_label'] = STATUS.get(d['status'], d['status'])
    for f in m.fields:
        if f.type == 'account' and d.get(f.name):
            d[f.name + '_code'] = ctx.accounts.get(d[f.name], {}).get('code')
        if f.type == 'loan' and d.get(f.name):
            d[f.name + '_code'] = ctx.loans.get(d[f.name], {}).get('code')
        if f.type == 'category' and d.get(f.name):
            d[f.name + '_name'] = ctx.cat_by_id.get(d[f.name], {}).get('name')
        if f.computed:
            d[f.name] = m.amount(d)
    if users is not None:
        for k in ('created_by', 'l1_by', 'dir_by', 'l2_by', 'audited_by'):
            if d.get(k):
                d[k + '_name'] = users.get(d[k])
    route = route_of(d)
    if d['status'] == 'draft' or not route:
        route, note = build_route(m, d, ctx)
        d['route_preview'] = True
        d['route_note'] = d.get('route_note') or note
    d['route_steps'] = route
    d['approve_label'] = APPROVE_LABEL.get(d['status'], 'Duyệt')
    if apps is not None:
        done = {a['step']: a for a in apps}
        d['steps'] = [{'key': 'make', 'label': 'Lập & gửi duyệt', 'by': d.get('created_by_name'), 'at': d.get('submitted_at'),
                       'state': 'done' if d.get('submitted_at') else 'cur'}]
        for s in route:
            a = done.get(s)
            state = 'done' if a else ('cur' if d['status'] == s else 'todo')
            d['steps'].append({'key': s, 'label': STEPS[s][0], 'by': a and a['user_name'], 'at': a and a['at'],
                               'note': a and a['note'], 'state': state})
    return d


def user_names(db):
    return {r['id']: r['full_name'] for r in db.all('SELECT id, full_name FROM users')}


def scope_sql(user, alias='d'):
    if is_global(user):
        return '', []
    ids = user['company_ids'] or [-1]
    return f' AND {alias}.company_id IN ({",".join("?" * len(ids))})', list(ids)


# ---------------------------------------------------------------- danh sách
def list_docs(db, user, m, status=None, company_id=None, date_from=None, date_to=None, q=None, mine=False,
              reopen=False, audit=False, limit=200, offset=0):
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
    counts = {r['status']: r['n'] for r in db.all(f'SELECT d.status, COUNT(*) AS n FROM {m.table} d{where} GROUP BY d.status', params)}
    counts['reopen'] = db.scalar(f'SELECT COUNT(*) FROM {m.table} d{where} AND d.reopen_requested=1', params)
    counts['audit'] = db.scalar(f"SELECT COUNT(*) FROM {m.table} d{where} AND d.status='posted' AND d.audited_at IS NULL", params)
    if status:
        where += ' AND d.status=?'
        params.append(status)
    if reopen:
        where += ' AND d.reopen_requested=1'
    if audit:
        where += " AND d.status='posted' AND d.audited_at IS NULL"
    rows = db.all(f'SELECT d.*, c.code AS company_code FROM {m.table} d LEFT JOIN companies c ON c.id=d.company_id'
                  f'{where} ORDER BY d.doc_date DESC, d.id DESC LIMIT ? OFFSET ?', params + [limit, offset])
    total = db.scalar(f'SELECT COUNT(*) FROM {m.table} d{where}', params)
    ctx, names = Ctx(db), user_names(db)
    apps = _apps_map(db, m, [r['id'] for r in rows])
    out = [decorate(m, r, ctx, names) for r in rows]
    for r in out:
        r['actions'] = actions(user, m, r, apps.get(r['id'], []))
    return {'rows': out, 'total': total, 'counts': counts}


def _apps_map(db, m, ids):
    out = {}
    if not ids:
        return out
    for a in db.all(f'SELECT doc_id, step, user_id FROM doc_approvals WHERE module=? AND doc_id IN ({",".join("?" * len(ids))})',
                    [m.key] + list(ids)):
        out.setdefault(a['doc_id'], []).append(a)
    return out


def actions(user, m, d, apps):
    """Các nút thao tác hợp lệ cho người dùng hiện tại."""
    st, a = d['status'], []
    owner = d['created_by'] == user['id']
    approved_by_me = any(x['user_id'] == user['id'] for x in apps)
    if st == 'draft' and (owner or is_admin(user)) and (can_create(user, m) or is_admin(user)):
        a += ['edit', 'delete', 'submit']
    if st in PENDING and not owner and not approved_by_me and can_do_step(user, m, d, st):
        a += ['approve', 'reject']
    if st == 'posted' and user['role'] == 'auditor' and not d.get('audited_at'):
        a += ['audit']
    if st in PENDING + ('posted',) and not d['reopen_requested'] and not is_admin(user):
        if owner or approved_by_me or (st in PENDING and can_do_step(user, m, d, st)):
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
    apps = approvals(db, m, doc_id)
    d = decorate(m, d, ctx, user_names(db), apps)
    d['actions'] = actions(user, m, d, apps)
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
    if hasattr(m, 'enrich'):
        m.enrich(doc, ctx)
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
    require(d['status'] == 'draft', 'Chỉ sửa được chứng từ ở trạng thái Nháp (đã gửi duyệt cần Quản trị hệ thống mở lại)')
    require(d['created_by'] == user['id'] or is_admin(user), 'Chỉ người lập hoặc Quản trị hệ thống được sửa')
    doc = _prepare(db, user, m, data)
    rec = {c: doc.get(c) for c in cols(m)}
    rec.update(company_id=doc['company_id'], doc_date=doc.get('doc_date'), updated_at=now_iso())
    db.update(m.table, doc_id, rec)
    log(db, m, doc_id, 'Sửa chứng từ', user)


def delete(db, user, m, doc_id):
    d = load(db, m, doc_id)
    require(d['status'] == 'draft', 'Chỉ xóa được chứng từ Nháp')
    require(d['created_by'] == user['id'] or is_admin(user), 'Chỉ người lập hoặc Quản trị hệ thống được xóa')
    db.execute(f'DELETE FROM {m.table} WHERE id=?', [doc_id])
    db.execute('DELETE FROM doc_approvals WHERE module=? AND doc_id=?', [m.key, doc_id])
    log(db, m, doc_id, 'Xóa chứng từ', user)


# ---------------------------------------------------------------- quy trình
def submit(db, user, m, doc_id):
    d = load(db, m, doc_id)
    require(d['status'] == 'draft', 'Chứng từ không ở trạng thái Nháp')
    require(d['created_by'] == user['id'] or is_admin(user), 'Chỉ người lập được gửi duyệt')
    ctx = Ctx(db)
    errors = m.validate(d, ctx)
    if errors:
        raise ApiError(422, 'Chứng từ còn lỗi, mở Sửa để kiểm tra', errors)
    route, note = build_route(m, d, ctx)
    db.execute('DELETE FROM doc_approvals WHERE module=? AND doc_id=?', [m.key, doc_id])
    db.update(m.table, doc_id, dict(status=route[0], route=','.join(route), route_note=note, submitted_at=now_iso(),
                                    reopen_requested=0, reopen_note=None))
    log(db, m, doc_id, 'Gửi duyệt – tuyến: ' + ' → '.join(STEPS[s][0] for s in route), user, note)


def approve(db, user, m, doc_id, note=None):
    d = load(db, m, doc_id)
    st = d['status']
    if st not in PENDING:
        raise ApiError(409, 'Chứng từ không ở trạng thái chờ duyệt')
    ctx = Ctx(db)
    require(can_do_step(user, m, d, st, ctx), f'Bước hiện tại "{STEPS[st][0]}" không thuộc quyền của bạn')
    require(d['created_by'] != user['id'], 'Người lập không được tự duyệt chứng từ của mình')
    apps = approvals(db, m, doc_id)
    require(not any(a['user_id'] == user['id'] for a in apps), 'Mỗi người chỉ được duyệt một bước trên cùng một chứng từ')
    if st == 'pay' and not (note or '').strip():
        raise ApiError(422, 'Ghi số UNC / mã giao dịch ngân hàng khi xác nhận đã chi', {'note': 'Bắt buộc'})
    route = route_of(d) or build_route(m, d, ctx)[0]
    nxt = route[route.index(st) + 1] if st in route and route.index(st) + 1 < len(route) else None
    db.insert('doc_approvals', dict(module=m.key, doc_id=doc_id, step=st, user_id=user['id'], user_name=user['full_name'],
                                    note=note, at=now_iso()))
    upd = {}
    if st == 'chk':
        upd.update(l1_by=user['id'], l1_at=now_iso())
    if st in ('dir', 'chair'):
        upd.update(dir_by=user['id'], dir_at=now_iso())
    if st == 'pay' and note and not d.get('doc_no'):
        upd['doc_no'] = note.strip()[:60]
    if nxt:
        upd['status'] = nxt
        db.update(m.table, doc_id, upd)
        log(db, m, doc_id, f'{STEPS[st][0]} – đồng ý', user, note)
        return nxt
    errors = m.validate(d, ctx)
    if errors:
        raise ApiError(422, 'Chứng từ không còn hợp lệ (TK bị khóa / dữ liệu khai báo thay đổi) – đề nghị mở lại để sửa', errors)
    post(db, m, dict(d, **upd), ctx)
    upd.update(status='posted', l2_by=user['id'], l2_at=now_iso(), posted_at=now_iso(), reopen_requested=0)
    db.update(m.table, doc_id, upd)
    if hasattr(m, 'on_posted'):
        m.on_posted(db, load(db, m, doc_id), ctx, user)
    log(db, m, doc_id, f'{STEPS[st][0]} – đã ghi sổ', user, note)
    return 'posted'


def reject(db, user, m, doc_id, note=None):
    """Người duyệt từ chối: trả chứng từ về Nháp cho người lập sửa (bút toán chưa ghi nên không ảnh hưởng sổ)."""
    d = load(db, m, doc_id)
    require(d['status'] in PENDING, 'Chứng từ không ở trạng thái chờ duyệt')
    require(can_do_step(user, m, d, d['status']) and d['created_by'] != user['id'], 'Bạn không xử lý bước này')
    if not (note or '').strip():
        raise ApiError(422, 'Ghi lý do trả lại', {'note': 'Bắt buộc'})
    db.execute('DELETE FROM doc_approvals WHERE module=? AND doc_id=?', [m.key, doc_id])
    db.update(m.table, doc_id, dict(status='draft', l1_by=None, l1_at=None, dir_by=None, dir_at=None, submitted_at=None))
    log(db, m, doc_id, f'Trả lại cho người lập ({STEPS[d["status"]][0]})', user, note)
    return 'draft'


def audit(db, user, m, doc_id, note=None):
    require(user['role'] == 'auditor', 'Chỉ Kiểm soát nội bộ hậu kiểm')
    d = load(db, m, doc_id)
    require(d['status'] == 'posted', 'Chỉ hậu kiểm chứng từ đã ghi sổ')
    db.update(m.table, doc_id, dict(audited_by=user['id'], audited_at=now_iso(), audit_note=note))
    log(db, m, doc_id, 'KSNB hậu kiểm', user, note)
    return 'audited'


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
    require('request_reopen' in actions(user, m, d, approvals(db, m, doc_id)), 'Bạn không thể đề nghị mở lại chứng từ này')
    if not note:
        raise ApiError(422, 'Vui lòng ghi lý do / nội dung sai cần sửa', {'note': 'Bắt buộc'})
    db.update(m.table, doc_id, dict(reopen_requested=1, reopen_note=note))
    log(db, m, doc_id, 'Đề nghị mở lại', user, note)


def reopen(db, user, m, doc_id, note=None):
    require(is_admin(user), 'Chỉ Quản trị hệ thống được mở lại chứng từ')
    d = load(db, m, doc_id)
    require(d['status'] != 'draft', 'Chứng từ đang là Nháp')
    if d['status'] == 'posted' and hasattr(m, 'on_unposted'):
        m.on_unposted(db, d, Ctx(db), user)
    db.execute('DELETE FROM ledger_entries WHERE module=? AND doc_id=?', [m.key, doc_id])
    db.execute('DELETE FROM doc_approvals WHERE module=? AND doc_id=?', [m.key, doc_id])
    db.update(m.table, doc_id, dict(status='draft', reopen_requested=0, l1_by=None, l1_at=None, dir_by=None, dir_at=None,
                                    l2_by=None, l2_at=None, posted_at=None, submitted_at=None, audited_by=None, audited_at=None))
    log(db, m, doc_id, 'Mở lại cho sửa' + (' (đã hủy bút toán)' if d['status'] == 'posted' else ''), user, note)


def cancel(db, user, m, doc_id, note=None):
    require(is_admin(user), 'Chỉ Quản trị hệ thống được hủy chứng từ')
    d = load(db, m, doc_id)
    require(d['status'] != 'cancelled', 'Chứng từ đã hủy')
    if d['status'] == 'posted' and hasattr(m, 'on_unposted'):
        m.on_unposted(db, d, Ctx(db), user)
    db.execute('DELETE FROM ledger_entries WHERE module=? AND doc_id=?', [m.key, doc_id])
    db.update(m.table, doc_id, dict(status='cancelled', reopen_requested=0, posted_at=None))
    log(db, m, doc_id, 'Hủy chứng từ', user, note)


ACTIONS = {'submit': submit, 'approve': approve, 'reject': reject, 'audit': audit, 'request_reopen': request_reopen,
           'reopen': reopen, 'cancel': cancel}


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
        conds = [f"d.status IN ({','.join('?' * len(PENDING))})"]
        cp = list(PENDING)
        if is_admin(user):
            conds = ['d.reopen_requested=1']
            cp = []
        rows = db.all(f'SELECT d.*, c.code AS company_code FROM {m.table} d LEFT JOIN companies c ON c.id=d.company_id '
                      f'WHERE ({" OR ".join(conds)}){scope_s} ORDER BY d.doc_date, d.id LIMIT 1000', cp + scope_p)
        apps = _apps_map(db, m, [r['id'] for r in rows])
        for r in rows:
            acts = actions(user, m, r, apps.get(r['id'], []))
            if not ('approve' in acts or (is_admin(user) and r['reopen_requested'])):
                continue
            r = decorate(m, r, ctx, names)
            r['module'], r['module_title'] = m.key, m.title
            r['actions'] = acts
            out.append(r)
    return out


def pending_counts(db, user):
    return {'inbox': len(inbox(db, user))}
