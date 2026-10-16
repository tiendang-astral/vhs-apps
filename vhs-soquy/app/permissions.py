"""Vai trò & quyền.

4 loại tài khoản:
- staff            : Nhân viên – được giao quyền theo nghiệp vụ (tạo chứng từ / duyệt lương) và theo công ty.
- chief_accountant : Kế toán trưởng – duyệt cấp 1 các nghiệp vụ kế toán của công ty được giao, xem tổng hợp.
- director         : Admin 2 – Giám đốc công ty trụ cột (TPE / VHS / ASTRAL-X): duyệt cấp 2 cho các công ty trong nhóm,
                     xem Dashboard + tổng hợp của nhóm.
- admin            : Admin tập đoàn – duyệt cuối cùng, xem toàn bộ, quản trị tài khoản, mở lại chứng từ / dữ liệu khai báo.
"""
from .http import ApiError

ROLES = {'staff': 'Nhân viên', 'chief_accountant': 'Kế toán trưởng', 'director': 'Giám đốc công ty trụ cột (Admin 2)',
         'admin': 'Admin tập đoàn'}

# Quyền gán cho tài khoản nhân viên (hiển thị ở màn hình quản trị)
PERMISSIONS = [
    ('cashbook.create', 'Kế toán – lập Thu Chi & Vay nợ'),
    ('partner_payment.create', 'Kế toán – lập Thanh toán đối tác'),
    ('cash_fund.create', 'Kế toán / thủ quỹ – lập Quỹ TM & tạm ứng'),
    ('payroll.create', 'Nhân sự – lập Thanh toán lương'),
    ('payroll.approve', 'Kế toán – duyệt cấp 1 Thanh toán lương'),
]


def is_admin(u):
    return u['role'] == 'admin'


def is_director(u):
    return u['role'] == 'director'


def in_scope(u, company_id):
    return is_admin(u) or (company_id in u['company_ids'])


def require_scope(u, company_id):
    if not in_scope(u, company_id):
        raise ApiError(403, 'Bạn không được phân quyền cho công ty này')


def can_create(u, module):
    return is_admin(u) or f'{module.key}.create' in u['perms']


def can_l1(u, module):
    if module.l1_rule == 'chief':
        return u['role'] == 'chief_accountant'
    return u['role'] == 'staff' and f'{module.key}.approve' in u['perms']


def can_view_module(u, module):
    if is_admin(u) or is_director(u):
        return True
    if u['role'] == 'chief_accountant':
        return module.l1_rule == 'chief'
    return f'{module.key}.create' in u['perms'] or f'{module.key}.approve' in u['perms']


def can_view_summary(u):
    return u['role'] in ('chief_accountant', 'director', 'admin')


def can_view_dashboard(u):
    return u['role'] in ('director', 'admin')


def require(cond, msg='Bạn không có quyền thực hiện thao tác này'):
    if not cond:
        raise ApiError(403, msg)
