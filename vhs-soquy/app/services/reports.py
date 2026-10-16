"""Báo cáo: sổ chi tiết ngày / tháng, tổng hợp ngày / tháng, dashboard, kiểm soát hạch toán.
Mọi số liệu đọc từ ledger_entries (chỉ chứa chứng từ đã được Admin duyệt cuối) + số dư đầu của tài khoản."""
import calendar
import datetime as dt
from collections import defaultdict

from ..modules import REGISTRY
from ..modules.base import Ctx
from ..modules.cashbook import LOAN_IN


# ---------------------------------------------------------------- tiện ích
def month_range(month):                     # 'YYYY-MM' -> ('YYYY-MM-01', 'YYYY-MM-last')
    y, m = int(month[:4]), int(month[5:7])
    return f'{y:04d}-{m:02d}-01', f'{y:04d}-{m:02d}-{calendar.monthrange(y, m)[1]:02d}'


def add_months(month, n):
    y, m = int(month[:4]), int(month[5:7]) + n
    while m < 1:
        y, m = y - 1, m + 12
    while m > 12:
        y, m = y + 1, m - 12
    return f'{y:04d}-{m:02d}'


def scope(user, company_id=None, col='company_id', alias=''):
    ids = user['company_ids'] or [-1]
    if company_id:
        ids = [company_id] if company_id in ids else [-1]
    pre = f'{alias}.' if alias else ''
    return f' AND {pre}{col} IN ({",".join("?" * len(ids))})', list(ids)


def today():
    return dt.date.today().isoformat()


# ---------------------------------------------------------------- số dư theo tài khoản
def account_balances(db, user, start, end, company_id=None):
    s, p = scope(user, company_id, alias='a')
    rows = db.all(f"""
        SELECT a.id, a.code, a.company_id, c.code AS company_code, a.kind, b.code AS bank_code, a.holder, a.status,
               a.min_balance, a.opening_balance,
               COALESCE(SUM(CASE WHEN e.txn_date < ? THEN e.amount_in - e.amount_out ELSE 0 END), 0) AS before_amt,
               COALESCE(SUM(CASE WHEN e.txn_date >= ? THEN e.amount_in ELSE 0 END), 0) AS inflow,
               COALESCE(SUM(CASE WHEN e.txn_date >= ? THEN e.amount_out ELSE 0 END), 0) AS outflow,
               COALESCE(SUM(CASE WHEN e.txn_date >= ? AND COALESCE(cat.nature, '') <> 'internal' THEN e.amount_in ELSE 0 END), 0) AS real_in,
               COALESCE(SUM(CASE WHEN e.txn_date >= ? AND COALESCE(cat.nature, '') <> 'internal' THEN e.amount_out ELSE 0 END), 0) AS real_out,
               COALESCE(SUM(CASE WHEN e.txn_date >= ? AND e.module = 'cash_fund' THEN e.amount_in ELSE 0 END), 0) AS fund_in
        FROM accounts a JOIN companies c ON c.id = a.company_id LEFT JOIN banks b ON b.id = a.bank_id
        LEFT JOIN ledger_entries e ON e.account_id = a.id AND e.txn_date <= ?
        LEFT JOIN categories cat ON cat.id = e.category_id
        WHERE 1=1{s}
        GROUP BY a.id, a.code, a.company_id, c.code, a.kind, b.code, a.holder, a.status, a.min_balance, a.opening_balance
        ORDER BY a.company_id, a.kind, a.code""", [start] * 6 + [end] + p)
    for r in rows:
        r['opening'] = int(r['opening_balance'] or 0) + int(r.pop('before_amt'))
        for k in ('inflow', 'outflow', 'real_in', 'real_out', 'fund_in'):
            r[k] = int(r[k])
        r['closing'] = r['opening'] + r['inflow'] - r['outflow']
        alert = ''
        if r['closing'] < 0:
            alert = 'Âm quỹ'
        elif r['min_balance'] is not None and r['closing'] < r['min_balance']:
            alert = 'Dưới tồn tối thiểu'
        elif r['status'] != 'active' and r['closing'] != 0:
            alert = 'TK khóa còn tiền'
        r['alert'] = alert
    return rows


def company_summary(db, user, accs):
    comps = {c['id']: c for c in db.all('SELECT c.id, c.code, c.name, g.name AS group_name FROM companies c '
                                        'LEFT JOIN company_groups g ON g.id=c.group_id ORDER BY c.id')}
    out = {}
    for a in accs:
        c = comps[a['company_id']]
        r = out.setdefault(a['company_id'], dict(company_id=a['company_id'], code=c['code'], name=c['name'], group=c['group_name'],
                                                 opening=0, inflow=0, outflow=0, closing=0, bank=0, cash=0, real_in=0, real_out=0, alerts=0))
        for k in ('opening', 'inflow', 'outflow', 'closing', 'real_in', 'real_out'):
            r[k] += a[k]
        r['bank' if a['kind'] == 'bank' else 'cash'] += a['closing']
        r['alerts'] += 1 if a['alert'] else 0
    rows = list(out.values())
    total = sum(r['closing'] for r in rows) or 0
    for r in rows:
        r['net'] = r['real_in'] - r['real_out']
        r['share'] = (r['closing'] / total) if total else 0
    return rows


def totals(rows, keys):
    return {k: sum(r.get(k) or 0 for r in rows) for k in keys}


# ---------------------------------------------------------------- sổ chi tiết
def ledger(db, user, start, end, company_id=None, account_id=None, category_id=None, limit=3000):
    s, p = scope(user, company_id, alias='e')
    where, params = f' WHERE e.txn_date >= ? AND e.txn_date <= ?{s}', [start, end] + p
    if account_id:
        where += ' AND e.account_id = ?'
        params.append(account_id)
    if category_id:
        where += ' AND e.category_id = ?'
        params.append(category_id)
    rows = db.all(f"""SELECT e.id, e.module, e.doc_id, e.txn_date, a.code AS account_code, c.code AS company_code, e.counterparty,
                             e.description, cat.name AS category, e.amount_in, e.amount_out, e.doc_no, a.kind
                      FROM ledger_entries e JOIN accounts a ON a.id = e.account_id JOIN companies c ON c.id = e.company_id
                      LEFT JOIN categories cat ON cat.id = e.category_id{where}
                      ORDER BY e.txn_date, e.id LIMIT ?""", params + [limit])
    opening = None
    if not category_id:
        sa, pa = scope(user, company_id, alias='a')
        accw, accp = ('', [])
        if account_id:
            accw, accp = ' AND a.id = ?', [account_id]
        opening = int(db.scalar(f'SELECT COALESCE(SUM(a.opening_balance), 0) FROM accounts a WHERE 1=1{sa}{accw}', pa + accp) or 0)
        ew, ep = ' WHERE e.txn_date < ?' + s, [start] + p
        if account_id:
            ew += ' AND e.account_id = ?'
            ep.append(account_id)
        opening += int(db.scalar(f'SELECT COALESCE(SUM(e.amount_in - e.amount_out), 0) FROM ledger_entries e{ew}', ep) or 0)
    titles = {k: m.title for k, m in REGISTRY.items()}
    bal = opening
    for r in rows:
        r['source'] = titles.get(r['module'], r['module'])
        if bal is not None:
            bal += r['amount_in'] - r['amount_out']
            r['balance'] = bal
    tin = sum(r['amount_in'] for r in rows)
    tout = sum(r['amount_out'] for r in rows)
    return {'opening': opening, 'inflow': tin, 'outflow': tout,
            'closing': (opening + tin - tout) if opening is not None else None, 'rows': rows, 'truncated': len(rows) >= limit}


# ---------------------------------------------------------------- tổng hợp
def summary_day(db, user, day, company_id=None):
    accs = account_balances(db, user, day, day, company_id)
    comps = company_summary(db, user, accs)
    keys = ['opening', 'inflow', 'outflow', 'closing', 'bank', 'cash', 'real_in', 'real_out']
    return {'date': day, 'accounts': accs, 'companies': comps, 'total': totals(comps, keys)}


def summary_month(db, user, month, company_id=None):
    start, end = month_range(month)
    accs = account_balances(db, user, start, end, company_id)
    comps = company_summary(db, user, accs)
    keys = ['opening', 'inflow', 'outflow', 'closing', 'bank', 'cash', 'real_in', 'real_out', 'net']
    groups = defaultdict(lambda: dict(opening=0, inflow=0, outflow=0, closing=0, bank=0, cash=0))
    for c in comps:
        g = groups[c['group'] or '(Chưa gán nhóm)']
        for k in g:
            g[k] += c[k]
    banks = defaultdict(int)
    for a in accs:
        banks[a['bank_code'] if a['kind'] == 'bank' else 'Tiền mặt'] += a['closing']
    return {
        'month': month, 'start': start, 'end': end, 'accounts': accs, 'companies': comps, 'total': totals(comps, keys),
        'groups': [dict(name=k, **v) for k, v in groups.items()],
        'banks': sorted([dict(bank=k or '?', closing=v) for k, v in banks.items()], key=lambda x: -x['closing']),
        'categories': categories(db, user, start, end, company_id),
        'daily': daily_series(db, user, start, end, comps, company_id),
        'loans': loans(db, user, start, end, company_id),
        'advances': advances(db, user, start, end, company_id),
        'payroll': payroll_summary(db, user, start, company_id),
        'partners': partner_summary(db, user, start, end, company_id),
        'intercompany': intercompany(db, user, start, end, company_id),
    }


def categories(db, user, start, end, company_id=None):
    s, p = scope(user, company_id, alias='e')
    rows = db.all(f"""SELECT COALESCE(cat.name, '(Chưa phân loại)') AS name, COALESCE(cat.nature, '') AS nature,
                             SUM(e.amount_in) AS inflow, SUM(e.amount_out) AS outflow
                      FROM ledger_entries e LEFT JOIN categories cat ON cat.id = e.category_id
                      WHERE e.txn_date >= ? AND e.txn_date <= ?{s} GROUP BY cat.name, cat.nature ORDER BY 4 DESC""", [start, end] + p)
    for r in rows:
        r['inflow'], r['outflow'] = int(r['inflow']), int(r['outflow'])
    return rows


def daily_series(db, user, start, end, comps, company_id=None):
    s, p = scope(user, company_id, alias='e')
    rows = db.all(f"""SELECT e.txn_date, e.company_id, SUM(e.amount_in) AS i, SUM(e.amount_out) AS o,
                             SUM(CASE WHEN COALESCE(cat.nature, '') <> 'internal' THEN e.amount_in ELSE 0 END) AS ri,
                             SUM(CASE WHEN COALESCE(cat.nature, '') <> 'internal' THEN e.amount_out ELSE 0 END) AS ro
                      FROM ledger_entries e LEFT JOIN categories cat ON cat.id = e.category_id
                      WHERE e.txn_date >= ? AND e.txn_date <= ?{s} GROUP BY e.txn_date, e.company_id""", [start, end] + p)
    by = defaultdict(dict)
    for r in rows:
        by[r['txn_date']][r['company_id']] = r
    bal = {c['company_id']: c['opening'] for c in comps}
    d0, d1 = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
    out, d = [], d0
    while d <= d1:
        k = d.isoformat()
        day = by.get(k, {})
        for cid, r in day.items():
            bal[cid] = bal.get(cid, 0) + int(r['i']) - int(r['o'])
        out.append(dict(date=k, real_in=sum(int(r['ri']) for r in day.values()), real_out=sum(int(r['ro']) for r in day.values()),
                        total=sum(bal.values()), companies={c['code']: bal.get(c['company_id'], 0) for c in comps}))
        d += dt.timedelta(days=1)
    return out


def trend(db, user, month, n=12):
    months = [add_months(month, i - n + 1) for i in range(n)]
    s, p = scope(user)
    base = int(db.scalar(f'SELECT COALESCE(SUM(opening_balance), 0) FROM accounts WHERE 1=1{s}', p) or 0)
    se, pe = scope(user, alias='e')
    first = months[0] + '-01'
    base += int(db.scalar(f'SELECT COALESCE(SUM(e.amount_in - e.amount_out), 0) FROM ledger_entries e WHERE e.txn_date < ?{se}',
                          [first] + pe) or 0)
    rows = db.all(f"""SELECT substr(e.txn_date, 1, 7) AS m, SUM(e.amount_in - e.amount_out) AS net_all,
                             SUM(CASE WHEN COALESCE(cat.nature, '') <> 'internal' THEN e.amount_in ELSE 0 END) AS ri,
                             SUM(CASE WHEN COALESCE(cat.nature, '') <> 'internal' THEN e.amount_out ELSE 0 END) AS ro
                      FROM ledger_entries e LEFT JOIN categories cat ON cat.id = e.category_id
                      WHERE e.txn_date >= ? AND e.txn_date <= ?{se} GROUP BY substr(e.txn_date, 1, 7)""",
                  [first, month_range(month)[1]] + pe)
    by = {r['m']: r for r in rows}
    out, bal = [], base
    for m in months:
        r = by.get(m)
        bal += int(r['net_all']) if r else 0
        out.append(dict(month=m, real_in=int(r['ri']) if r else 0, real_out=int(r['ro']) if r else 0, closing=bal))
    return out


def _docs(db, user, table, extra='', params=(), company_id=None):
    s, p = scope(user, company_id, alias='d')
    return db.all(f'SELECT d.*, c.code AS company_code FROM {table} d LEFT JOIN companies c ON c.id = d.company_id '
                  f'WHERE 1=1{s}{extra}', p + list(params))


def loans(db, user, start, end, company_id=None):
    docs = _docs(db, user, 'doc_cashbook', " AND d.status='posted' AND d.contract_no IS NOT NULL AND d.doc_date <= ?", [end], company_id)
    out = {}
    for d in docs:
        if d['kind'] not in LOAN_IN + ['Trả nợ gốc vay', 'Trả lãi vay']:
            continue
        r = out.setdefault(d['contract_no'], dict(contract_no=d['contract_no'], lender=None, company=d['company_code'], loan_type='',
                                                  rate=None, maturity=None, received=0, repaid=0, interest=0, disbursed_month=0,
                                                  repaid_month=0))
        in_month = d['doc_date'] >= start
        if d['kind'] in LOAN_IN:
            r['received'] += d['amount']
            r['lender'] = r['lender'] or d['counterparty']
            r['loan_type'] = 'Cá nhân' if d['kind'] == 'Nhận vay cá nhân' else 'Ngân hàng'
            r['rate'] = d['interest_rate'] if d['interest_rate'] is not None else r['rate']
            if d['maturity_date'] and (not r['maturity'] or d['maturity_date'] > r['maturity']):
                r['maturity'] = d['maturity_date']
            if in_month:
                r['disbursed_month'] += d['amount']
        elif d['kind'] == 'Trả nợ gốc vay':
            r['repaid'] += d['amount']
            if in_month:
                r['repaid_month'] += d['amount']
        else:
            r['interest'] += d['amount']
    ref = today()
    for r in out.values():
        r['outstanding'] = r['received'] - r['repaid']
        if r['outstanding'] <= 0:
            r['state'] = 'Đã tất toán'
        elif not r['maturity']:
            r['state'] = 'Chưa có ngày đáo hạn'
        elif r['maturity'] < ref:
            r['state'] = 'QUÁ HẠN'
        elif (dt.date.fromisoformat(r['maturity']) - dt.date.fromisoformat(ref)).days <= 30:
            r['state'] = 'Đến hạn ≤30 ngày'
        else:
            r['state'] = 'Đang vay'
    return sorted(out.values(), key=lambda r: -r['outstanding'])


def advances(db, user, start, end, company_id=None):
    out = defaultdict(lambda: dict(advanced=0, refunded=0, settled=0, advanced_month=0))
    for d in _docs(db, user, 'doc_cash_fund', " AND d.status='posted' AND d.doc_date <= ? AND d.person IS NOT NULL", [end], company_id):
        r = out[d['person']]
        if d['kind'] == 'Tạm ứng nhân viên':
            r['advanced'] += d['amount']
            if d['doc_date'] >= start:
                r['advanced_month'] += d['amount']
        elif d['kind'] == 'Hoàn ứng nhân viên':
            r['refunded'] += d['amount']
        elif d['kind'] == 'Quyết toán tạm ứng':
            r['settled'] += d['amount']
    for d in _docs(db, user, 'doc_cashbook', " AND d.status='posted' AND d.doc_date <= ? AND d.kind='Hoàn ứng NV (chuyển khoản)'",
                   [end], company_id):
        out[d['counterparty']]['refunded'] += d['amount']
    for d in _docs(db, user, 'doc_payroll', " AND d.status='posted' AND d.doc_date <= ? AND COALESCE(d.advance_deduction, 0) > 0",
                   [end], company_id):
        out[d['employee']]['settled'] += d['advance_deduction']
    rows = []
    for name, r in out.items():
        r['outstanding'] = r['advanced'] - r['refunded'] - r['settled']
        if r['advanced'] or r['outstanding']:
            rows.append(dict(person=name, **r))
    return sorted(rows, key=lambda r: -r['outstanding'])


def payroll_summary(db, user, period_start, company_id=None):
    m = REGISTRY['payroll']
    out = {}
    for d in _docs(db, user, 'doc_payroll', " AND d.period = ? AND d.status <> 'cancelled'", [period_start], company_id):
        r = out.setdefault(d['company_code'], dict(company=d['company_code'], employees=0, gross=0, deductions=0, net=0, paid=0, pending=0))
        net = m.net(d)
        r['employees'] += 1
        r['gross'] += (d['gross'] or 0) + (d['bonus'] or 0)
        r['deductions'] += (d['gross'] or 0) + (d['bonus'] or 0) - net
        r['net'] += net
        r['paid' if d['status'] == 'posted' else 'pending'] += net
    return list(out.values())


def partner_summary(db, user, start, end, company_id=None):
    out = defaultdict(lambda: dict(paid_month=0, paid_total=0, pending=0, overdue=0))
    ref = today()
    for d in _docs(db, user, 'doc_partner_payment', " AND d.status <> 'cancelled'", [], company_id):
        r = out[d['partner']]
        if d['status'] == 'posted':
            if d['doc_date'] <= end:
                r['paid_total'] += d['amount']
            if start <= d['doc_date'] <= end:
                r['paid_month'] += d['amount']
        else:
            r['pending'] += d['amount'] or 0
            if d['due_date'] and d['due_date'] < ref:
                r['overdue'] += d['amount'] or 0
    return sorted([dict(partner=k, **v) for k, v in out.items()], key=lambda r: -(r['paid_month'] + r['pending']))


def intercompany(db, user, start, end, company_id=None):
    ctx = Ctx(db)
    codes = {c['id']: c['code'] for c in db.all('SELECT id, code FROM companies')}
    out = defaultdict(lambda: dict(sent_month=0, recv_month=0, sent_total=0, recv_total=0))
    s, p = scope(user, company_id, alias='d')
    for d in db.all(f"SELECT d.* FROM doc_cash_fund d WHERE d.status='posted' AND d.doc_date <= ? "
                    f"AND d.from_account_id IS NOT NULL AND d.to_account_id IS NOT NULL", [end]):
        fc, tc = ctx.accounts[d['from_account_id']]['company_id'], ctx.accounts[d['to_account_id']]['company_id']
        if fc == tc:
            continue
        if not (fc in user['company_ids'] or tc in user['company_ids']):
            continue
        mo = d['doc_date'] >= start
        out[codes[fc]]['sent_total'] += d['amount']
        out[codes[tc]]['recv_total'] += d['amount']
        if mo:
            out[codes[fc]]['sent_month'] += d['amount']
            out[codes[tc]]['recv_month'] += d['amount']
    rows = [dict(company=k, **v, balance=v['recv_total'] - v['sent_total']) for k, v in out.items()]
    return sorted(rows, key=lambda r: r['company'])


def cash_funds(db, user, start, end, day, company_id=None):
    accs = [a for a in account_balances(db, user, start, end, company_id) if a['kind'] == 'cash']
    day_bal = {a['id']: a['closing'] for a in account_balances(db, user, day, day, company_id) if a['kind'] == 'cash'}
    s, p = scope(user, company_id, alias='e')
    kinds = db.all(f"""SELECT e.account_id, f.kind, SUM(e.amount_in) AS i, SUM(e.amount_out) AS o FROM ledger_entries e
                       JOIN doc_cash_fund f ON e.module = 'cash_fund' AND f.id = e.doc_id
                       WHERE e.txn_date >= ? AND e.txn_date <= ?{s} GROUP BY e.account_id, f.kind""", [start, end] + p)
    k = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    for r in kinds:
        k[r['account_id']][r['kind']] = [int(r['i']), int(r['o'])]
    out = {}
    for a in accs:
        kk = k[a['id']]
        r = out.setdefault(a['company_code'], dict(company=a['company_code'], holder=a['holder'] or '', opening=0, fund_in=0,
                                                   other_in=0, employee_adv=0, other_out=0, returned=0, closing=0, at_day=0))
        fund_in = kk['Tạm ứng quỹ TM'][0] + kk['Chuyển nội bộ'][0]
        emp = kk['Tạm ứng nhân viên'][1]
        ret = kk['Hoàn quỹ về NH'][1] + kk['Chuyển nội bộ'][1]
        r['opening'] += a['opening']
        r['fund_in'] += fund_in
        r['other_in'] += a['inflow'] - fund_in
        r['employee_adv'] += emp
        r['returned'] += ret
        r['other_out'] += a['outflow'] - emp - ret
        r['closing'] += a['closing']
        r['at_day'] += day_bal.get(a['id'], 0)
    return list(out.values())


# ---------------------------------------------------------------- dashboard
def dashboard(db, user, month, day):
    start, end = month_range(month)
    sm = summary_month(db, user, month)
    sd_acc = account_balances(db, user, day, day)
    prev = trend(db, user, add_months(month, -1), 1)[0]
    funds = cash_funds(db, user, start, end, day)
    tot = sm['total']
    pend = {}
    for key, m in REGISTRY.items():
        s, p = scope(user, alias='d')
        pend[key] = {r['status']: r['n'] for r in db.all(
            f'SELECT d.status, COUNT(*) AS n FROM {m.table} d WHERE 1=1{s} GROUP BY d.status', p)}
    cats = [c for c in sm['categories'] if c['nature'] != 'internal' and c['outflow'] > 0]
    loans_ = sm['loans']
    return {
        'month': month, 'day': day,
        'kpi': dict(total=tot['closing'], opening=tot['opening'], bank=tot['bank'], cash=tot['cash'], real_in=tot['real_in'],
                    real_out=tot['real_out'], all_in=tot['inflow'], all_out=tot['outflow'], net=tot['real_in'] - tot['real_out'],
                    prev_net=prev['real_in'] - prev['real_out'], day_total=sum(a['closing'] for a in sd_acc),
                    day_in=sum(a['inflow'] for a in sd_acc), day_out=sum(a['outflow'] for a in sd_acc),
                    loan_outstanding=sum(l['outstanding'] for l in loans_),
                    advances_outstanding=sum(a['outstanding'] for a in sm['advances'])),
        'trend': trend(db, user, month, 12),
        'companies': sorted(sm['companies'], key=lambda r: -r['closing']),
        'groups': sm['groups'], 'banks': sm['banks'], 'categories': cats[:8], 'daily': sm['daily'],
        'cash_funds': funds, 'loans': loans_[:10], 'payroll': sm['payroll'], 'partners': sm['partners'][:10],
        'intercompany': sm['intercompany'],
        'alerts': [a for a in sd_acc if a['alert']],
        'pending': pend,
    }


# ---------------------------------------------------------------- kiểm soát hạch toán
def control(db, user):
    """Tính lại bút toán từ chứng từ đã duyệt (đường 1) và so với sổ cái đã lưu (đường 2)."""
    ctx = Ctx(db)
    src = defaultdict(lambda: [0, 0])          # (module, account_id) -> [in, out]
    mod = defaultdict(lambda: dict(docs=0, pending=0, src_in=0, src_out=0, led_in=0, led_out=0))
    for key, m in REGISTRY.items():
        for d in db.all(f'SELECT * FROM {m.table}'):
            if d['status'] != 'posted':
                if d['status'] != 'cancelled':
                    mod[key]['pending'] += 1
                continue
            mod[key]['docs'] += 1
            for l in m.lines(d, ctx):
                src[(key, l['account_id'])][0] += l['amount_in']
                src[(key, l['account_id'])][1] += l['amount_out']
                mod[key]['src_in'] += l['amount_in']
                mod[key]['src_out'] += l['amount_out']
    led = defaultdict(lambda: [0, 0])
    for r in db.all('SELECT module, account_id, SUM(amount_in) AS i, SUM(amount_out) AS o FROM ledger_entries GROUP BY module, account_id'):
        led[(r['module'], r['account_id'])] = [int(r['i']), int(r['o'])]
        mod[r['module']]['led_in'] += int(r['i'])
        mod[r['module']]['led_out'] += int(r['o'])
    orphan = db.scalar("""SELECT COUNT(*) FROM ledger_entries e WHERE NOT EXISTS (
        SELECT 1 FROM doc_cashbook d WHERE e.module='cashbook' AND d.id=e.doc_id AND d.status='posted'
        UNION ALL SELECT 1 FROM doc_partner_payment d WHERE e.module='partner_payment' AND d.id=e.doc_id AND d.status='posted'
        UNION ALL SELECT 1 FROM doc_payroll d WHERE e.module='payroll' AND d.id=e.doc_id AND d.status='posted'
        UNION ALL SELECT 1 FROM doc_cash_fund d WHERE e.module='cash_fund' AND d.id=e.doc_id AND d.status='posted')""")
    modules = []
    for key, m in REGISTRY.items():
        r = mod[key]
        r.update(module=key, title=m.title, ok=(r['src_in'] == r['led_in'] and r['src_out'] == r['led_out']))
        modules.append(r)
    accs = []
    for a in db.all('SELECT a.id, a.code, a.kind, a.opening_balance, c.code AS company FROM accounts a JOIN companies c ON c.id=a.company_id ORDER BY a.company_id, a.code'):
        si = sum(v[0] for (k, acc), v in src.items() if acc == a['id'])
        so = sum(v[1] for (k, acc), v in src.items() if acc == a['id'])
        li = sum(v[0] for (k, acc), v in led.items() if acc == a['id'])
        lo = sum(v[1] for (k, acc), v in led.items() if acc == a['id'])
        by_mod = {k: src[(k, a['id'])][0] - src[(k, a['id'])][1] for k in REGISTRY}
        accs.append(dict(code=a['code'], company=a['company'], kind=a['kind'], opening=a['opening_balance'], src_in=si, src_out=so,
                         led_in=li, led_out=lo, src_balance=a['opening_balance'] + si - so, led_balance=a['opening_balance'] + li - lo,
                         by_module=by_mod, ok=(si == li and so == lo)))
    all_ok = all(m['ok'] for m in modules) and all(a['ok'] for a in accs) and not orphan
    return {'ok': all_ok, 'orphans': orphan, 'modules': modules, 'accounts': accs}
