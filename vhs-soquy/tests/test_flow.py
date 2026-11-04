"""Kiểm thử toàn bộ quy trình qua HTTP (chạy server thật trên SQLite tạm).
Chạy:  python tests/test_flow.py"""
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
PASS, FAIL = [], []


def check(name, cond, info=''):
    (PASS if cond else FAIL).append(name)
    print(('  ✓ ' if cond else '  ✗ ') + name + ('' if cond else f'  → {info}'))


class Client:
    def __init__(self, base):
        self.base, self.tok = base, None

    def req(self, method, path, **kw):
        h = {'Authorization': f'Bearer {self.tok}'} if self.tok else {}
        r = requests.request(method, self.base + path, headers=h, timeout=30, **kw)
        try:
            return r.status_code, r.json()
        except ValueError:
            return r.status_code, r.text

    def login(self, u, p):
        s, j = self.req('POST', '/api/auth/login', json={'username': u, 'password': p})
        assert s == 200, j
        self.tok = j['token']
        return self

    get = lambda self, p, **kw: self.req('GET', p, **kw)
    post = lambda self, p, j=None: self.req('POST', p, json=j or {})
    put = lambda self, p, j=None: self.req('PUT', p, json=j or {})
    delete = lambda self, p: self.req('DELETE', p)


def main():
    tmp = tempfile.mkdtemp()
    port = socket.socket(); port.bind(('127.0.0.1', 0)); p = port.getsockname()[1]; port.close()
    env = dict(os.environ, DATABASE_URL=os.getenv('TEST_DATABASE_URL') or f'sqlite:///{tmp}/t.db', SECRET_KEY='x' * 48, SEED_LEGACY='1')
    srv = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--port', str(p)], cwd=ROOT, env=env,
                           stdout=subprocess.DEVNULL, stderr=open(os.path.join(tmp, 'server.log'), 'w'))
    print('Log máy chủ:', os.path.join(tmp, 'server.log'))
    base = f'http://127.0.0.1:{p}'
    try:
        for _ in range(100):
            try:
                requests.get(base + '/api/health', timeout=1); break
            except requests.ConnectionError:
                time.sleep(0.2)
        run(base)
    finally:
        srv.terminate()
    print(f'\n{len(PASS)} đạt, {len(FAIL)} lỗi')
    sys.exit(1 if FAIL else 0)


def run(base):
    admin = Client(base).login('admin', 'Admin@123')
    print('1. Dữ liệu cũ')
    d = admin.get('/api/reports/dashboard?month=2026-05&date=2026-05-31')[1]
    check('Tổng số dư sau dữ liệu cũ = 863.233.490', d['kpi']['total'] == 863233490, d['kpi'])
    check('Kiểm soát hạch toán khớp', admin.get('/api/reports/control')[1]['ok'])

    opts = admin.get('/api/options')[1]
    co = {c['code']: c['id'] for c in opts['companies']}
    acc = {a['code']: a['id'] for a in opts['accounts']}
    vhs_cos = [co['VHS'], co['DP'], co['MPN'], co['VHS-LS']]

    print('2. Tài khoản theo mô hình kế toán mới')
    users = {
        'kt1': dict(role='staff', permissions=['cashbook.create', 'partner_payment.create', 'cash_fund.create'], company_ids=[co['VHS'], co['DP']]),
        'ktth': dict(role='chief_accountant', company_ids=vhs_cos),
        'ktth2': dict(role='chief_accountant', company_ids=[co['TPE']]),
        'hr': dict(role='staff', permissions=['payroll.create'], company_ids=[co['VHS']]),
        'ktl': dict(role='staff', permissions=['payroll.approve'], company_ids=[co['VHS']]),
        'gdvhs': dict(role='director', company_ids=vhs_cos),
        'cfo': dict(role='cfo'), 'ksnb': dict(role='auditor'), 'ct': dict(role='chairman'), 'nq': dict(role='treasury'),
        'kt2': dict(role='staff', permissions=['cashbook.create', 'partner_payment.create'], company_ids=[co['TPE']]),
    }
    for name, u in users.items():
        s, j = admin.post('/api/users', dict(u, username=name, full_name=name.upper(), password='123456'))
        check(f'Tạo tài khoản {name}', s == 201, j)
    s, j = admin.post('/api/users', dict(username='x', full_name='X', role='staff', password='123456'))
    check('Nhân viên bắt buộc có công ty', s == 422, j)
    C = {n: Client(base).login(n, '123456') for n in users}
    kt1, ktth, ktth2, hr, ktl, gd, cfo, ksnb, ct, nq, kt2 = (C[n] for n in users)
    check('CFO phạm vi toàn tập đoàn', len(cfo.get('/api/me')[1]['company_ids']) == len(co))

    def doc_of(mod, i):
        return admin.get(f'/api/docs/{mod}/{i}')[1]

    def outflow(day, code):
        return admin.get(f'/api/reports/ledger?from={day}&to={day}&account_id={acc[code]}')[1]

    print('3. Khoản thu thường: KTV lập → KTTH kiểm tra → ghi sổ')
    s, j = kt1.post('/api/docs/cashbook', dict(doc_date='2026-06-02', kind='Thu tiền khách hàng', account_id=acc['MB-VHS'], amount=60_000_000,
                                               counterparty='Khách A', description='Thu tiền hàng', _submit=True)); tid = j['id']
    check('Tuyến thu = [KTTH]', doc_of('cashbook', tid)['route_steps'] == ['chk'], doc_of('cashbook', tid)['route_steps'])
    s, j = kt1.post(f'/api/docs/cashbook/{tid}/approve')
    check('Người lập không tự duyệt', s == 403, j)
    s, j = ktth2.post(f'/api/docs/cashbook/{tid}/approve')
    check('KTTH công ty khác không kiểm tra được', s == 403, j)
    s, j = ktth.post(f'/api/docs/cashbook/{tid}/approve')
    check('KTTH xác nhận → ghi sổ', s == 200 and j['result'] == 'posted', j)
    check('Đã ghi sổ 60.000.000', outflow('2026-06-02', 'MB-VHS')['inflow'] == 60_000_000)

    print('4. Khoản chi thường đến N: KTTH → CFO → GĐ nhóm → Ngân quỹ')
    pp = dict(doc_date='2026-06-06', account_id=acc['MB-VHS'], partner='NCC B', amount=50_000_000, description='Thanh toán hàng')
    s, j = kt1.post('/api/docs/partner_payment', pp); pid = j['id']
    check('Lập nháp', s == 201, j)
    check('Xem trước tuyến khi còn nháp', doc_of('partner_payment', pid)['route_steps'] == ['chk', 'ctl', 'dir', 'pay'])
    check('Gửi duyệt', kt1.post(f'/api/docs/partner_payment/{pid}/submit')[0] == 200)
    check('Không sửa được sau khi gửi', kt1.put(f'/api/docs/partner_payment/{pid}', pp)[0] in (400, 403, 409))
    check('Trạng thái Chờ KTTH', doc_of('partner_payment', pid)['status'] == 'chk')
    check('CFO chưa duyệt được ở bước KTTH', cfo.post(f'/api/docs/partner_payment/{pid}/approve')[0] == 403)
    check('GĐ nhóm chưa duyệt được ở bước KTTH', gd.post(f'/api/docs/partner_payment/{pid}/approve')[0] == 403)
    check('KTTH thấy trong hộp xử lý', any(x['id'] == pid for x in ktth.get('/api/inbox')[1]))
    check('KTTH kiểm tra', ktth.post(f'/api/docs/partner_payment/{pid}/approve')[1].get('result') == 'ctl')
    check('CFO thấy trong hộp xử lý', any(x['id'] == pid and x['module'] == 'partner_payment' for x in cfo.get('/api/inbox')[1]))
    check('KSNB không có việc ở khoản thường', not any(x['id'] == pid and x['module'] == 'partner_payment' for x in ksnb.get('/api/inbox')[1]))
    check('CFO kiểm soát cấp 1', cfo.post(f'/api/docs/partner_payment/{pid}/approve')[1].get('result') == 'dir')
    check('Ngân quỹ chưa chi khi GĐ chưa duyệt', nq.post(f'/api/docs/partner_payment/{pid}/approve', {'note': 'UNC1'})[0] == 403)
    check('GĐ nhóm duyệt', gd.post(f'/api/docs/partner_payment/{pid}/approve')[1].get('result') == 'pay')
    check('Chưa ghi sổ trước khi Ngân quỹ chi', outflow('2026-06-06', 'MB-VHS')['outflow'] == 0)
    s, j = nq.post(f'/api/docs/partner_payment/{pid}/approve')
    check('Ngân quỹ phải ghi số UNC', s == 422, j)
    s, j = nq.post(f'/api/docs/partner_payment/{pid}/approve', {'note': 'UNC-0606-01'})
    check('Ngân quỹ xác nhận đã chi → ghi sổ', s == 200 and j['result'] == 'posted', j)
    dd = doc_of('partner_payment', pid)
    check('Số UNC lưu vào số chứng từ', dd['doc_no'] == 'UNC-0606-01', dd['doc_no'])
    check('Đủ 5 bước trên tuyến', [x['state'] for x in dd['steps']] == ['done'] * 5, dd['steps'])
    check('Ghi sổ chi 50.000.000', outflow('2026-06-06', 'MB-VHS')['outflow'] == 50_000_000)
    check('Quản trị hệ thống không duyệt chi', 'approve' not in dd['actions'])

    print('5. Khoản chi trên N: thêm KSNB kiểm trước + Chủ tịch')
    s, j = kt1.post('/api/docs/partner_payment', dict(pp, amount=250_000_000, doc_date='2026-06-08', _submit=True)); bid = j['id']
    b = doc_of('partner_payment', bid)
    check('Tuyến trên N', b['route_steps'] == ['chk', 'ctl', 'pre', 'dir', 'chair', 'pay'], b['route_steps'])
    check('Có lý do trên N', 'ngưỡng N' in (b['route_note'] or ''), b['route_note'])
    ktth.post(f'/api/docs/partner_payment/{bid}/approve'); cfo.post(f'/api/docs/partner_payment/{bid}/approve')
    check('Chủ tịch chưa duyệt khi KSNB chưa kiểm', ct.post(f'/api/docs/partner_payment/{bid}/approve')[0] == 403)
    check('KSNB kiểm tra trước', ksnb.post(f'/api/docs/partner_payment/{bid}/approve')[1].get('result') == 'dir')
    check('GĐ nhóm duyệt → Chủ tịch', gd.post(f'/api/docs/partner_payment/{bid}/approve')[1].get('result') == 'chair')
    check('Chủ tịch thấy trong hộp xử lý', any(x['id'] == bid for x in ct.get('/api/inbox')[1]))
    check('Chủ tịch duyệt → Ngân quỹ', ct.post(f'/api/docs/partner_payment/{bid}/approve')[1].get('result') == 'pay')
    check('Ngân quỹ chi', nq.post(f'/api/docs/partner_payment/{bid}/approve', {'note': 'UNC-0608'})[1].get('result') == 'posted')

    print('6. Giao dịch đặc biệt: bên liên quan VHS – DP, vay')
    s, j = kt1.post('/api/docs/partner_payment', dict(pp, partner='DP', amount=20_000_000, doc_date='2026-06-09', _submit=True)); sid = j['id']
    sp = doc_of('partner_payment', sid)
    check('Đối tác là công ty trong hệ thống → đặc biệt, không qua GĐ nhóm', sp['route_steps'] == ['chk', 'ctl', 'pre', 'chair', 'pay'], sp['route_steps'])
    ktth.post(f'/api/docs/partner_payment/{sid}/approve'); cfo.post(f'/api/docs/partner_payment/{sid}/approve'); ksnb.post(f'/api/docs/partner_payment/{sid}/approve')
    check('GĐ nhóm VHS không duyệt khoản VHS – DP', gd.post(f'/api/docs/partner_payment/{sid}/approve')[0] == 403)
    check('Chủ tịch duyệt', ct.post(f'/api/docs/partner_payment/{sid}/approve')[1].get('result') == 'pay')
    s, j = kt1.post('/api/docs/partner_payment', dict(pp, amount=10_000_000, special_type='NCC mới', _submit=True))
    check('Chọn NCC mới → có Chủ tịch', 'chair' in doc_of('partner_payment', j['id'])['route_steps'])
    s, j = kt1.post('/api/docs/cashbook', dict(doc_date='2026-06-10', kind='Giải ngân vay ngân hàng', account_id=acc['MB-VHS'], amount=500_000_000,
                                               counterparty='MB', contract_no='HDV-01', _submit=True)); lid = j['id']
    check('Vay = đặc biệt, không có bước chi', doc_of('cashbook', lid)['route_steps'] == ['chk', 'ctl', 'pre', 'chair'])
    for c_ in (ktth, cfo, ksnb):
        c_.post(f'/api/docs/cashbook/{lid}/approve')
    check('Chủ tịch duyệt khoản vay → ghi sổ', ct.post(f'/api/docs/cashbook/{lid}/approve')[1].get('result') == 'posted')

    print('7. Trả lại, mở lại, hủy')
    s, j = kt1.post('/api/docs/partner_payment', dict(pp, amount=7_000_000, doc_date='2026-06-11', _submit=True)); rid = j['id']
    check('Trả lại phải ghi lý do', ktth.post(f'/api/docs/partner_payment/{rid}/reject')[0] == 422)
    check('KTTH trả lại', ktth.post(f'/api/docs/partner_payment/{rid}/reject', {'note': 'Thiếu hóa đơn'})[1].get('result') == 'draft')
    check('Người lập sửa & gửi lại', kt1.put(f'/api/docs/partner_payment/{rid}', dict(pp, amount=7_000_000, doc_date='2026-06-11', _submit=True))[0] == 200)
    check('Gửi lại bắt đầu từ KTTH', doc_of('partner_payment', rid)['status'] == 'chk')
    check('Đề nghị mở lại phải có lý do', kt1.post(f'/api/docs/partner_payment/{pid}/request_reopen', {})[0] in (400, 422))
    check('Đề nghị mở lại', kt1.post(f'/api/docs/partner_payment/{pid}/request_reopen', {'note': 'Sai số tiền'})[0] == 200)
    check('Quản trị thấy đề nghị mở lại', any(x['id'] == pid for x in admin.get('/api/inbox')[1]))
    check('CFO không mở lại được', cfo.post(f'/api/docs/partner_payment/{pid}/reopen')[0] == 403)
    check('Quản trị mở lại', admin.post(f'/api/docs/partner_payment/{pid}/reopen')[0] == 200)
    check('Mở lại → hủy bút toán', outflow('2026-06-06', 'MB-VHS')['outflow'] == 0)
    check('Mở lại → xóa các lần duyệt', all(x['state'] != 'done' for x in doc_of('partner_payment', pid)['steps'][1:]))
    s, j = kt1.post('/api/docs/partner_payment', dict(pp, amount=5_000_000, _submit=True))
    check('Quản trị hủy chứng từ', admin.post(f'/api/docs/partner_payment/{j["id"]}/cancel', {'note': 'Trùng'})[0] == 200)

    print('8. Giai đoạn 2: Kế toán trưởng nhóm')
    s, j = admin.post('/api/users', dict(username='kttn', full_name='KTT NHOM VHS', role='group_chief', password='123456', company_ids=vhs_cos))
    check('Tạo KTT nhóm', s == 201, j); kttn = Client(base).login('kttn', '123456')
    s, j = kt1.post('/api/docs/partner_payment', dict(pp, amount=30_000_000, _submit=True)); g1 = j['id']
    s, j = kt1.post('/api/docs/partner_payment', dict(pp, amount=300_000_000, _submit=True)); g2 = j['id']
    ktth.post(f'/api/docs/partner_payment/{g1}/approve'); ktth.post(f'/api/docs/partner_payment/{g2}/approve')
    check('KTT nhóm kiểm soát khoản đến N', kttn.post(f'/api/docs/partner_payment/{g1}/approve')[0] == 200)
    check('KTT nhóm không kiểm soát khoản trên N', kttn.post(f'/api/docs/partner_payment/{g2}/approve')[0] == 403)
    check('CFO kiểm soát khoản trên N', cfo.post(f'/api/docs/partner_payment/{g2}/approve')[0] == 200)

    print('9. Nhóm chưa có Giám đốc nhóm (TPE) → Chủ tịch thay')
    s, j = kt2.post('/api/docs/partner_payment', dict(pp, account_id=acc['MB-TPE'], amount=8_000_000, _submit=True)); t1 = j['id']
    check('Tuyến TPE: Chủ tịch thay GĐ nhóm', doc_of('partner_payment', t1)['route_steps'] == ['chk', 'ctl', 'chair', 'pay'])
    check('Ghi chú lý do', 'Giám đốc nhóm' in (doc_of('partner_payment', t1)['route_note'] or ''))

    print('10. Mỗi người chỉ duyệt một bước')
    s, j = admin.post('/api/users', dict(username='kt3', full_name='KT3', role='staff', permissions=['partner_payment.create'], password='123456', company_ids=vhs_cos))
    kt3 = Client(base).login('kt3', '123456')
    s, j = kt3.post('/api/docs/partner_payment', dict(pp, account_id=acc['MB-VHS'], amount=4_000_000, _submit=True)); o1 = j['id']
    ktth.post(f'/api/docs/partner_payment/{o1}/approve')
    admin.put(f'/api/users/{next(u["id"] for u in admin.get("/api/users")[1] if u["username"] == "ktth")}',
              dict(username='ktth', full_name='KTTH', role='cfo', password=''))
    check('Người đã kiểm tra không kiểm soát tiếp cùng chứng từ', ktth.post(f'/api/docs/partner_payment/{o1}/approve')[0] == 403)
    admin.put(f'/api/users/{next(u["id"] for u in admin.get("/api/users")[1] if u["username"] == "ktth")}',
              dict(username='ktth', full_name='KTTH', role='chief_accountant', password='', company_ids=vhs_cos))

    print('11. Lương: Nhân sự lập → KTV lương → CFO → GĐ nhóm → Ngân quỹ')
    pay = dict(period='2026-06', employee='Nguyễn Văn A', company_id=co['VHS'], gross=20_000_000, bonus=2_000_000,
               insurance=2_100_000, pit=500_000, doc_date='2026-06-05', account_id=acc['MB-VHS'])
    s, j = hr.post('/api/docs/payroll', dict(pay, _submit=True)); wid = j.get('id')
    check('HR lập bảng lương', s == 201, j)
    check('KTV lương kiểm tra', ktl.post(f'/api/docs/payroll/{wid}/approve')[0] == 200)
    cfo.post(f'/api/docs/payroll/{wid}/approve'); gd.post(f'/api/docs/payroll/{wid}/approve')
    check('Ngân quỹ chi lương', nq.post(f'/api/docs/payroll/{wid}/approve', {'note': 'UNC-LUONG-06'})[1].get('result') == 'posted')
    check('Ghi sổ thực lĩnh 19.400.000', outflow('2026-06-05', 'MB-VHS')['outflow'] == 19_400_000, outflow('2026-06-05', 'MB-VHS'))
    s, j = hr.post('/api/docs/payroll', dict(pay, employee='Trần E', _submit=True))
    check('KTTH cũng kiểm tra được bảng lương', ktth.post(f'/api/docs/payroll/{j["id"]}/approve')[0] == 200)

    print('12. Quỹ TM: chuyển nguồn giữa hai pháp nhân là giao dịch đặc biệt')
    s, j = kt1.post('/api/docs/cash_fund', dict(doc_date='2026-06-03', kind='Tạm ứng quỹ TM', from_account_id=acc['MB-VHS'],
                                                to_account_id=acc['TM-VHS'], amount=10_000_000, _submit=True)); fid = j['id']
    check('Cùng pháp nhân → tuyến thường', doc_of('cash_fund', fid)['route_steps'] == ['chk', 'ctl', 'dir', 'pay'])
    s, j = kt1.post('/api/docs/cash_fund', dict(doc_date='2026-06-03', kind='Chuyển nội bộ', from_account_id=acc['MB-VHS'],
                                                to_account_id=acc['MB-TPE'], amount=10_000_000, _submit=True))
    check('Khác pháp nhân → Chủ tịch', 'chair' in doc_of('cash_fund', j['id'])['route_steps'])
    for c_ in (ktth, cfo, gd):
        s, r = c_.post('/api/docs/cash_fund/bulk', {'ids': [fid], 'action': 'approve'})
    check('Duyệt hàng loạt', r.get('done') == 1, r)
    check('Ngân quỹ duyệt hàng loạt có UNC', nq.post('/api/docs/cash_fund/bulk', {'ids': [fid], 'action': 'approve', 'note': 'UNC-QUY'})[1].get('done') == 1)
    d = admin.get('/api/reports/summary-day?date=2026-06-03')[1]
    tm = next(a for a in d['accounts'] if a['code'] == 'TM-VHS')
    check('Quỹ TM VHS tăng 10.000.000', tm['closing'] == 10_000_000, tm)

    print('13. KSNB hậu kiểm')
    lst = ksnb.get('/api/docs/partner_payment?audit=1')[1]
    check('KSNB thấy danh sách chờ hậu kiểm', lst['total'] >= 1, lst['total'])
    check('KTTH không hậu kiểm được', ktth.post(f'/api/docs/partner_payment/{bid}/audit')[0] == 403)
    check('KSNB hậu kiểm', ksnb.post(f'/api/docs/partner_payment/{bid}/audit', {'note': 'Đủ hồ sơ'})[0] == 200)
    check('Đã ghi nhận hậu kiểm', bool(doc_of('partner_payment', bid)['audited_at']))

    print('14. Ngưỡng N theo nhóm')
    vhs_group = next(c['group_id'] for c in opts['companies'] if c['code'] == 'VHS')
    grp = next(g for g in admin.get('/api/master/company_groups')[1] if g['id'] == vhs_group)
    s, j = admin.put(f'/api/master/company_groups/{vhs_group}', dict(name=grp['name'], field=grp.get('field'), threshold_n=30_000_000, note=grp.get('note')))
    check('Đặt ngưỡng N nhóm VHS = 30 triệu', s == 200, j)
    s, j = kt1.post('/api/docs/partner_payment', dict(pp, amount=40_000_000))
    check('40 triệu > N mới → có Chủ tịch', 'chair' in doc_of('partner_payment', j['id'])['route_steps'])

    print('15. Quyền xem')
    check('Nhân viên không xem tổng hợp', kt1.get('/api/reports/summary-month?month=2026-06')[0] == 403)
    check('KTTH xem tổng hợp', ktth.get('/api/reports/summary-month?month=2026-06')[0] == 200)
    check('KTTH không xem Dashboard', ktth.get('/api/reports/dashboard')[0] == 403)
    check('HR không xem Thu Chi', hr.get('/api/docs/cashbook')[0] == 403)
    s, j = kt1.get('/api/reports/ledger?from=2026-04-01&to=2026-06-30')
    check('Sổ chi tiết chỉ gồm công ty phụ trách', s == 200 and {r['company_code'] for r in j['rows']} <= {'VHS', 'DP'}, j.get('rows', [])[:1])
    s, dg = gd.get('/api/reports/dashboard?month=2026-06&date=2026-06-30')
    check('GĐ nhóm xem Dashboard nhóm', s == 200 and {c['code'] for c in dg['companies']} <= {'VHS', 'DP', 'MPN', 'VHS-LS'})
    s, dc = ct.get('/api/reports/dashboard?month=2026-06&date=2026-06-30')
    check('Chủ tịch xem toàn tập đoàn', s == 200 and dc['scope_label'] == 'Toàn tập đoàn' and len(dc['group_options']) == 3, dc.get('scope_label'))
    check('CFO xem Dashboard', cfo.get('/api/reports/dashboard')[0] == 200)
    check('CFO xem Kiểm soát hạch toán', cfo.get('/api/reports/control')[0] == 200)
    check('KSNB xem Kiểm soát hạch toán', ksnb.get('/api/reports/control')[0] == 200)
    check('GĐ nhóm không xem Kiểm soát', gd.get('/api/reports/control')[0] == 403)
    tpe_group = next(c['group_id'] for c in opts['companies'] if c['code'] == 'TPE')
    check('GĐ nhóm không xem nhóm khác', gd.get(f'/api/reports/dashboard?group_id={tpe_group}')[0] == 403)
    check('Chỉ quản trị hệ thống quản lý tài khoản', cfo.get('/api/users')[0] == 403 and ct.get('/api/users')[0] == 403)

    print('16. Nhập bảng lương từ Excel')
    import io
    import base64
    from openpyxl import load_workbook
    r = requests.get(base + '/api/docs/payroll/template', headers={'Authorization': f'Bearer {hr.tok}'})
    check('Tải biểu mẫu Excel', r.status_code == 200 and r.content[:2] == b'PK', r.status_code)
    wb = load_workbook(io.BytesIO(r.content)); ws = wb['Nhập liệu']
    heads = [c.value for c in ws[1]]
    col = {h.replace(' *', ''): i + 1 for i, h in enumerate(heads)}
    rows = [('07/2026', 'VHS', 'Trần Thị B', 'Kế toán', 15_000_000, 1_000_000, 1_575_000, 0, 0, 0, '05/08/2026', 'MB-VHS'),
            ('07/2026', 'VHS', 'Lê Văn C', 'Kho', 12_000_000, None, 1_260_000, None, 500_000, None, '05/08/2026', 'MB-VHS')]
    keys = ['Kỳ lương', 'Công ty hạch toán lương', 'Nhân viên', 'Bộ phận', 'Lương + phụ cấp', 'Thưởng', 'BHXH, BHYT (NLĐ)', 'Thuế TNCN',
            'Trừ tạm ứng', 'Khấu trừ khác', 'Ngày chi trả', 'TK chi trả']
    for rno, vals in enumerate(rows, 2):
        for k, v in zip(keys, vals):
            ws.cell(row=rno, column=col[k], value=v)
    buf = io.BytesIO(); wb.save(buf); b64 = base64.b64encode(buf.getvalue()).decode()
    s, j = hr.post('/api/docs/payroll/import', {'file': b64, 'filename': 'luong.xlsx', 'dry_run': False, 'submit': True})
    check('Nhập 2 chứng từ & gửi duyệt', s == 201 and j['created'] == 2, j)
    check('KTV lương thấy 2 chứng từ chờ kiểm tra', ktl.get('/api/docs/payroll?status=chk')[1]['total'] >= 2)

    print('17. Dữ liệu khai báo: khóa / mở khóa')
    s, j = kt1.post('/api/master/partners', dict(name='NCC Test', type='supplier')); mid = j.get('id')
    check('Nhân viên thêm đối tác', s == 201, j)
    check('Khóa (submit)', kt1.post('/api/master/partners/lock', {'ids': [mid]})[0] == 200)
    check('Không sửa sau khóa', kt1.put(f'/api/master/partners/{mid}', dict(name='X', type='supplier'))[0] in (403, 409))
    check('CFO không mở khóa', cfo.post('/api/master/partners/unlock', {'ids': [mid]})[0] == 403)
    check('Quản trị mở khóa', admin.post('/api/master/partners/unlock', {'ids': [mid]})[0] == 200)

    print('18. Kiểm soát cuối')
    check('Kiểm soát hạch toán vẫn khớp', admin.get('/api/reports/control')[1]['ok'])
    uid = next(u['id'] for u in admin.get('/api/users')[1] if u['username'] == 'cfo')
    check('Xóa user đã duyệt chứng từ → khóa', admin.delete(f'/api/users/{uid}')[1]['result'] == 'deactivated')


if __name__ == '__main__':
    main()
