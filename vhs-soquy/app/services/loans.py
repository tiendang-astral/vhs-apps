"""Phân hệ Khoản vay: sổ khoản vay, dư nợ tính từ chứng từ, lịch trả nợ, cảnh báo, Dashboard vay.

Sổ khoản vay (bảng loans) chỉ được ghi bởi hồ sơ vay đã được Chủ tịch duyệt (modules/loan.py).
Dư nợ = giải ngân đã ghi sổ − trả gốc đã ghi sổ (chứng từ Thu Chi & Vay nợ có chọn khoản vay).
"""
import calendar
import datetime as dt
import json

from ..http import ApiError, now_iso, today
from ..permissions import is_global, require

LOAN_IN = ('Giải ngân vay ngân hàng', 'Nhận vay cá nhân')
ACTIVE_SET = ('Đang vay',)


# ---------------------------------------------------------------- ghi sổ khoản vay từ hồ sơ
def apply_dossier(db, d, ctx):
    from ..modules.loan import K_COLL, K_EXTEND, K_LIMIT, K_LOAN, K_RATE, K_RECON
    k, prev = d['kind'], None
    if k in (K_LIMIT, K_LOAN):
        rec = dict(code=d['code'], kind='limit' if k == K_LIMIT else 'loan', company_id=d['company_id'], lender=d['lender'],
                   lender_type=d['lender_type'], contract_no=d['contract_no'], drawdown_no=d.get('drawdown_no'),
                   limit_id=d.get('limit_id'), term=d.get('term'),
                   amount=d['limit_amount'] if k == K_LIMIT else d['amount'], start_date=d.get('start_date'),
                   maturity_date=d['maturity_date'], rate=d.get('rate'), rate_type=d.get('rate_type'),
                   interest_day=d.get('interest_day'), repay_method=d.get('repay_method'), collateral=d.get('collateral'),
                   purpose=d.get('description'), source_doc_id=d['id'], created_at=now_iso())
        db.insert('loans', rec)
    elif k in (K_EXTEND, K_RATE):
        ln = db.one('SELECT * FROM loans WHERE id=?', [d['loan_id']])
        prev = {f: ln[f] for f in ('maturity_date', 'rate')}
        upd = {}
        if d.get('new_maturity'):
            upd['maturity_date'] = d['new_maturity']
        if d.get('new_rate') is not None:
            upd['rate'] = d['new_rate']
        db.update('loans', ln['id'], upd)
    elif k == K_COLL:
        db.insert('loan_collaterals', dict(loan_id=d['loan_id'], description=d['collateral'], owner_company_id=d.get('owner_company_id'),
                                           value=d.get('collateral_value'), insurance_expiry=d.get('insurance_expiry'),
                                           source_doc_id=d['id']))
    elif k == K_RECON:
        book = balance(db, d['loan_id'], end=_month_end(d['period']))
        db.insert('loan_recons', dict(loan_id=d['loan_id'], period=d['period'][:7], book_balance=book, bank_balance=d['bank_balance'],
                                      diff=d['bank_balance'] - book, source_doc_id=d['id'], note=d.get('note')))
    db.update('doc_loan', d['id'], dict(prev_json=json.dumps(prev) if prev else None))


def revert_dossier(db, d):
    from ..modules.loan import K_COLL, K_EXTEND, K_LIMIT, K_LOAN, K_RATE, K_RECON
    k = d['kind']
    if k in (K_LIMIT, K_LOAN):
        ln = db.one('SELECT id FROM loans WHERE source_doc_id=?', [d['id']])
        if ln:
            used = db.scalar("SELECT COUNT(*) FROM doc_cashbook WHERE loan_id=? AND status<>'cancelled'", [ln['id']])
            used += db.scalar("SELECT COUNT(*) FROM doc_loan WHERE (loan_id=? OR limit_id=?) AND status<>'cancelled' AND id<>?",
                              [ln['id'], ln['id'], d['id']])
            if used:
                raise ApiError(409, 'Khoản vay đã có chứng từ hoặc hồ sơ liên quan – hủy các chứng từ đó trước khi mở lại hồ sơ gốc')
            db.execute('DELETE FROM loans WHERE id=?', [ln['id']])
    elif k in (K_EXTEND, K_RATE) and d.get('prev_json'):
        db.update('loans', d['loan_id'], json.loads(d['prev_json']))
    elif k == K_COLL:
        db.execute('DELETE FROM loan_collaterals WHERE source_doc_id=?', [d['id']])
    elif k == K_RECON:
        db.execute('DELETE FROM loan_recons WHERE source_doc_id=?', [d['id']])


def _month_end(period):
    y, m = int(period[:4]), int(period[5:7])
    return f'{y:04d}-{m:02d}-{calendar.monthrange(y, m)[1]:02d}'


# ---------------------------------------------------------------- dư nợ
def movements(db, loan_ids=None, end=None):
    """{loan_id: dict(disbursed, repaid, interest, last_date)} từ chứng từ đã ghi sổ."""
    q = "SELECT loan_id, kind, amount, doc_date FROM doc_cashbook WHERE status='posted' AND loan_id IS NOT NULL"
    p = []
    if end:
        q += ' AND doc_date<=?'
        p.append(end)
    out = {}
    for r in db.all(q, p):
        if loan_ids is not None and r['loan_id'] not in loan_ids:
            continue
        m = out.setdefault(r['loan_id'], dict(disbursed=0, repaid=0, interest=0))
        if r['kind'] in LOAN_IN:
            m['disbursed'] += r['amount']
        elif r['kind'] == 'Trả nợ gốc vay':
            m['repaid'] += r['amount']
        elif r['kind'] == 'Trả lãi vay':
            m['interest'] += r['amount']
    return out


def balance(db, loan_id, end=None):
    m = movements(db, {loan_id}, end).get(loan_id, {})
    return m.get('disbursed', 0) - m.get('repaid', 0)


def pending_amounts(db, loan_id, exclude_doc=None):
    """Giải ngân / trả gốc đang trên tuyến duyệt (chưa ghi sổ) – để chặn vượt hạn mức, vượt dư nợ."""
    rows = db.all("SELECT id, kind, amount FROM doc_cashbook WHERE loan_id=? AND status NOT IN ('posted','cancelled','draft')", [loan_id])
    dis = sum(r['amount'] for r in rows if r['kind'] in LOAN_IN and r['id'] != exclude_doc)
    rep = sum(r['amount'] for r in rows if r['kind'] == 'Trả nợ gốc vay' and r['id'] != exclude_doc)
    return dis, rep


def status_of(ln, mv):
    if ln['kind'] == 'limit':
        return 'Hạn mức'
    if not mv.get('disbursed'):
        return 'Chờ giải ngân'
    return 'Đang vay' if mv['disbursed'] - mv['repaid'] > 0 else 'Đã tất toán'


def warnings(ln, ref, last_recon=None, colls=()):
    w = []
    if ln['status'] != 'Đang vay':
        return w
    if ln['rate'] is None:
        w.append('Thiếu lãi suất')
    elif ln['rate'] > 10:
        w.append('Lãi >10%')
    if ln['maturity_date']:
        d = (dt.date.fromisoformat(ln['maturity_date']) - ref).days
        if d < 0:
            w.append('QUÁ HẠN')
        elif d <= 7:
            w.append('Đến hạn ≤7 ngày')
        elif d <= 30:
            w.append('Đến hạn ≤30 ngày')
        elif d <= 90:
            w.append('Đến hạn 31–90 ngày')
    prev_month = (ref.replace(day=1) - dt.timedelta(days=1)).strftime('%Y-%m')
    if ln['start_date'] and ln['start_date'][:7] <= prev_month and (not last_recon or last_recon < prev_month):
        w.append(f'Chưa đối chiếu dư nợ {prev_month[5:]}/{prev_month[:4]}')
    for c in colls:
        if c['insurance_expiry'] and (dt.date.fromisoformat(c['insurance_expiry']) - ref).days <= 30:
            w.append('Bảo hiểm TSĐB sắp / đã hết hạn')
            break
    return w


def _scope(user):
    if is_global(user):
        return '', []
    ids = user['company_ids'] or [-1]
    return f' AND l.company_id IN ({",".join("?" * len(ids))})', list(ids)


def list_loans(db, user, company_id=None, include_limits=True):
    s, p = _scope(user)
    if company_id:
        s += ' AND l.company_id=?'
        p.append(company_id)
    rows = db.all(f'SELECT l.*, c.code AS company_code FROM loans l JOIN companies c ON c.id=l.company_id WHERE 1=1{s} ORDER BY l.id', p)
    mv = movements(db)
    ref = dt.date.fromisoformat(today())
    recon = {r['loan_id']: r['p'] for r in db.all('SELECT loan_id, MAX(period) AS p FROM loan_recons GROUP BY loan_id')}
    colls = {}
    for c in db.all('SELECT * FROM loan_collaterals'):
        colls.setdefault(c['loan_id'], []).append(c)
    used_limit = {}
    out = []
    for r in rows:
        m = mv.get(r['id'], {})
        r['disbursed'], r['repaid'], r['interest_paid'] = m.get('disbursed', 0), m.get('repaid', 0), m.get('interest', 0)
        r['outstanding'] = r['disbursed'] - r['repaid']
        r['status'] = status_of(r, m)
        r['warnings'] = warnings(r, ref, recon.get(r['id']), colls.get(r['id'], []))
        if r['limit_id']:
            used_limit[r['limit_id']] = used_limit.get(r['limit_id'], 0) + max(r['outstanding'], 0)
        out.append(r)
    for r in out:
        if r['kind'] == 'limit':
            r['outstanding'] = used_limit.get(r['id'], 0)
            r['available'] = r['amount'] - r['outstanding']
    if not include_limits:
        out = [r for r in out if r['kind'] == 'loan']
    return out


def options(db):
    rows = db.all('SELECT l.id, l.code, l.kind, l.company_id, l.lender, l.contract_no, c.code AS company_code '
                  'FROM loans l JOIN companies c ON c.id=l.company_id ORDER BY l.code')
    mv = movements(db)
    for r in rows:
        r['status'] = status_of(r, mv.get(r['id'], {}))
    return rows


# ---------------------------------------------------------------- lịch trả nợ
def _add_month(d, n=1):
    y, m = d.year + (d.month - 1 + n) // 12, (d.month - 1 + n) % 12 + 1
    return dt.date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def schedule(ln, mv, ref=None):
    """Lịch dự kiến các kỳ còn lại: gốc theo cách trả, lãi ước tính trên dư nợ (lãi suất × số ngày / 365)."""
    out = []
    if ln['kind'] != 'loan' or not ln['maturity_date']:
        return out
    ref = ref or dt.date.fromisoformat(today())
    bal = (mv.get('disbursed') or ln['amount'] or 0) - mv.get('repaid', 0)
    if bal <= 0:
        return out
    mat = dt.date.fromisoformat(ln['maturity_date'])
    rate = (ln['rate'] or 0) / 100
    iday = int(ln['interest_day'] or mat.day)
    dates, d = [], ref.replace(day=1)
    while True:
        cand = dt.date(d.year, d.month, min(iday, calendar.monthrange(d.year, d.month)[1]))
        if cand > mat:
            break
        if cand >= ref:
            dates.append(cand)
        d = _add_month(d)
    if not dates or dates[-1] != mat:
        dates.append(mat)
    n = len(dates)
    prev = ref
    for i, day in enumerate(dates):
        if ln['repay_method'] == 'Trả gốc đều hằng tháng':
            principal = round(bal / (n - i)) if i < n - 1 else bal
        else:
            principal = bal if i == n - 1 else 0
        interest = round(bal * rate * (day - prev).days / 365)
        out.append(dict(date=day.isoformat(), principal=principal, interest=interest, balance_after=bal - principal,
                        estimated=ln['repay_method'] == 'Theo lịch của ngân hàng'))
        bal -= principal
        prev = day
    return out


def group_schedule(db, user, days=90):
    ref = dt.date.fromisoformat(today())
    end = ref + dt.timedelta(days=days)
    mv = movements(db)
    rows = []
    for ln in list_loans(db, user, include_limits=False):
        if ln['status'] != 'Đang vay':
            continue
        for k in schedule(ln, mv.get(ln['id'], {}), ref):
            if dt.date.fromisoformat(k['date']) <= end and (k['principal'] or k['interest']):
                rows.append(dict(k, loan_id=ln['id'], code=ln['code'], company_code=ln['company_code'], lender=ln['lender']))
    rows.sort(key=lambda r: r['date'])
    return {'days': days, 'rows': rows, 'principal': sum(r['principal'] for r in rows), 'interest': sum(r['interest'] for r in rows)}


# ---------------------------------------------------------------- chi tiết, tổng hợp
def detail(db, user, loan_id):
    ln = next((r for r in list_loans(db, user) if r['id'] == loan_id), None)
    if not ln:
        raise ApiError(404, 'Khoản vay không tồn tại hoặc ngoài phạm vi của bạn')
    mv = movements(db, {loan_id}).get(loan_id, {})
    ln['schedule'] = schedule(ln, mv)
    ln['transactions'] = db.all('SELECT id, doc_date, kind, amount, status, doc_no FROM doc_cashbook WHERE loan_id=? ORDER BY doc_date, id', [loan_id])
    ln['dossiers'] = db.all('SELECT id, doc_date, kind, status, description FROM doc_loan WHERE loan_id=? OR limit_id=? OR id=? '
                            'ORDER BY doc_date, id', [loan_id, loan_id, ln['source_doc_id']])
    ln['collaterals'] = db.all('SELECT k.*, c.code AS owner_code FROM loan_collaterals k LEFT JOIN companies c ON c.id=k.owner_company_id '
                               'WHERE k.loan_id=?', [loan_id])
    ln['recons'] = db.all('SELECT * FROM loan_recons WHERE loan_id=? ORDER BY period DESC', [loan_id])
    if ln['kind'] == 'limit':
        ln['children'] = [r for r in list_loans(db, user) if r['limit_id'] == loan_id]
    return ln


def dashboard(db, user):
    loans_ = list_loans(db, user, include_limits=True)
    act = [r for r in loans_ if r['kind'] == 'loan' and r['status'] == 'Đang vay']
    tot = sum(r['outstanding'] for r in act)
    ref = dt.date.fromisoformat(today())

    def due(a, b):
        return sum(r['outstanding'] for r in act if r['maturity_date'] and a <= (dt.date.fromisoformat(r['maturity_date']) - ref).days <= b)

    def group(key):
        g = {}
        for r in act:
            x = g.setdefault(r[key] or '?', [0, 0])
            x[0 if r['term'] == 'Ngắn hạn' else 1] += r['outstanding']
        return sorted(({'name': k, 'short': v[0], 'long': v[1], 'total': v[0] + v[1]} for k, v in g.items()), key=lambda z: -z['total'])
    rated = [r for r in act if r['rate'] is not None]
    rs = sum(r['outstanding'] for r in rated)
    by_c, by_b = group('company_code'), group('lender')
    short = sum(r['outstanding'] for r in act if r['term'] == 'Ngắn hạn')
    cross = db.all('SELECT k.*, l.code, l.company_id, c1.code AS borrower, c2.code AS owner FROM loan_collaterals k '
                   'JOIN loans l ON l.id=k.loan_id JOIN companies c1 ON c1.id=l.company_id '
                   'LEFT JOIN companies c2 ON c2.id=k.owner_company_id WHERE k.owner_company_id IS NOT NULL AND k.owner_company_id<>l.company_id')
    if not is_global(user):
        cross = [c for c in cross if c['company_id'] in user['company_ids']]
    return {
        'total': tot, 'count': len(act), 'short': short, 'long': tot - short,
        'avg_rate': round(sum(r['outstanding'] * r['rate'] for r in rated) / rs, 2) if rs else None,
        'overdue': sum(r['outstanding'] for r in act if r['maturity_date'] and r['maturity_date'] < today()),
        'due30': due(0, 30), 'due90': due(31, 90),
        'by_company': by_c, 'by_lender': by_b,
        'check_ok': sum(x['total'] for x in by_c) == tot == sum(x['total'] for x in by_b),
        'limits': [r for r in loans_ if r['kind'] == 'limit'],
        'warnings': [dict(code=r['code'], company_code=r['company_code'], outstanding=r['outstanding'], warnings=r['warnings'], id=r['id'])
                     for r in loans_ if r['warnings']],
        'cross_guarantees': cross,
        'schedule': group_schedule(db, user, 90),
    }
