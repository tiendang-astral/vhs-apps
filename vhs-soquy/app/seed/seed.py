"""Khởi tạo khi CSDL còn trống: tài khoản Quản trị, cơ cấu tập đoàn (nhóm, công ty, ngân hàng, hạng mục).
Dữ liệu mẫu cũ (tài khoản NH / quỹ, 441 giao dịch Excel) chỉ nạp khi SEED_LEGACY=1 – mặc định không nạp."""
import json
from pathlib import Path

from ..config import settings
from ..db import get_db, startup_lock
from ..http import now_iso
from ..modules import REGISTRY
from ..modules.base import Ctx
from ..security import hash_password
from ..services.workflow import post

NATURE = {'Hoạt động KD': 'operating', 'Tài chính': 'financing', 'Nội bộ': 'internal'}
STATUS = {'Hoạt động': 'active', 'Tạm khóa': 'locked', 'Đã đóng': 'closed'}


def ensure_admin(db):
    if db.scalar('SELECT COUNT(*) FROM users') == 0:
        db.insert('users', dict(username=settings.ADMIN_USERNAME, full_name=settings.ADMIN_FULLNAME, role='admin',
                                password_hash=hash_password(settings.ADMIN_PASSWORD), permissions='', active=1, created_at=now_iso()))
    return db.scalar("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1")


def _data():
    return json.loads((Path(__file__).parent / 'legacy_data.json').read_text(encoding='utf-8'))


def seed_structure(db, admin_id):
    """Cơ cấu tập đoàn – không phải dữ liệu mẫu."""
    data, ts = _data(), now_iso()
    base = dict(locked=1, created_by=admin_id, created_at=ts)
    gid = {}
    for code, name, field in data['groups']:
        gid[code] = db.insert('company_groups', dict(name=name, field=field, **base))
    cid = {}
    for code, name, group, role in data['companies']:
        cid[code] = db.insert('companies', dict(code=code, name=name, group_id=gid[group], role=role, status='active', **base))
    bid = {}
    for code, name, note in data['banks']:
        if code != 'TM':
            bid[code] = db.insert('banks', dict(code=code, name=name, note=note or None, **base))
    for name, nature, desc in data['cats'] + [['Điều chuyển nội bộ', 'Nội bộ', 'Chuyển tiền giữa các TK trong tập đoàn']]:
        db.insert('categories', dict(name=name, nature=NATURE[nature], note=desc or None, **base))


def seed_legacy(db, admin_id):
    """Dữ liệu mẫu cũ từ file Excel – chỉ dùng chạy thử."""
    data, ts = _data(), now_iso()
    base = dict(locked=1, created_by=admin_id, created_at=ts)
    cid = {r['code']: r['id'] for r in db.all('SELECT id, code FROM companies')}
    bid = {r['code']: r['id'] for r in db.all('SELECT id, code FROM banks')}
    for a in data['accounts']:
        if a['cur'] != 'VND':
            continue
        cash = a['bank'] == 'TM'
        db.insert('accounts', dict(code=a['code'], company_id=cid[a['co']], kind='cash' if cash else 'bank',
                                   bank_id=None if cash else bid[a['bank']], number=a['accno'] or None, branch=a['branch'] or None,
                                   opening_balance=int(a['ob'] or 0), opening_date='2026-04-01', status=STATUS[a['status']],
                                   note=a['note'] or None, **base))
    # giao dịch cũ → chứng từ Thu Chi & Vay nợ đã duyệt
    m, ctx = REGISTRY['cashbook'], Ctx(db)
    acc = {r['code']: r for r in db.all('SELECT id, code, company_id FROM accounts')}
    for t in data['tx']:
        thu = bool(t['thu'])
        kind = ('Thu tiền khách hàng' if t['cat'] == 'Tiền hàng / doanh thu' else 'Lãi tiền gửi' if t['cat'] == 'Lãi tiền gửi'
                else 'Thu khác') if thu else ('Phí ngân hàng / SMS' if t['cat'] == 'Phí ngân hàng' else 'Chi khác')
        a = acc[t['acc']]
        rec = dict(company_id=a['company_id'], doc_date=t['date'], status='posted', created_by=admin_id, created_at=ts,
                   updated_at=ts, submitted_at=ts, l1_by=admin_id, l1_at=ts, l2_by=admin_id, l2_at=ts, posted_at=ts,
                   kind=kind, account_id=a['id'], counterparty=t['who'], description=t['content'],
                   category_id=ctx.cat_id(t['cat']), amount=int(t['thu'] or t['chi']), note=t['note'])
        doc_id = db.insert('doc_cashbook', rec)
        rec['id'] = doc_id
        post(db, m, rec, ctx)
        db.insert('doc_events', dict(module='cashbook', doc_id=doc_id, action='Nhập từ sổ quỹ Excel (dữ liệu cũ, đã duyệt)',
                                     user_id=admin_id, user_name='Hệ thống', at=ts))


def run():
    with get_db() as db:
        startup_lock(db)
        admin_id = ensure_admin(db)
        if db.scalar('SELECT COUNT(*) FROM companies') == 0:
            seed_structure(db, admin_id)
            if settings.SEED_LEGACY:
                seed_legacy(db, admin_id)
