"""Vai trò & quyền – theo Mô hình Tài chính – Kế toán TIMORI GROUP (v06).

Vai trò:
- staff            : Nhân viên / Kế toán viên (KTV) – lập chứng từ theo quyền được giao, theo công ty.
- chief_accountant : KTTH – Phụ trách kế toán – kiểm tra hồ sơ (bước "KTTH kiểm tra") các công ty được giao.
- group_chief      : Kế toán trưởng nhóm (giai đoạn 2) – kiểm soát cấp 1 khoản đến ngưỡng N của nhóm.
- cfo              : Giám đốc tài chính – kiểm soát cấp 1 mọi khoản (giai đoạn 1) và khoản trên N / đặc biệt (giai đoạn 2).
- auditor          : Kiểm soát nội bộ (KSNB) – kiểm tra trước khoản trên N / đặc biệt; hậu kiểm chứng từ đã ghi sổ.
- director         : Giám đốc nhóm (VHS / TPE / ASTRAL-X) – duyệt cấp 2 đến ngưỡng N, đề xuất khoản trên N.
- chairman         : Chủ tịch – duyệt khoản trên N và giao dịch đặc biệt.
- treasury         : Ngân quỹ – Thanh toán – thực hiện chi trên ngân hàng, xác nhận số UNC và ghi sổ.
- admin            : Quản trị hệ thống – tài khoản, dữ liệu khai báo, mở lại / hủy chứng từ; KHÔNG tham gia duyệt.
"""
from .http import ApiError

ROLES = {
    'staff': 'Nhân viên / Kế toán viên',
    'chief_accountant': 'KTTH – Phụ trách kế toán',
    'group_chief': 'Kế toán trưởng nhóm',
    'cfo': 'Giám đốc tài chính (CFO)',
    'auditor': 'Kiểm soát nội bộ (KSNB)',
    'director': 'Giám đốc nhóm',
    'chairman': 'Chủ tịch',
    'treasury': 'Ngân quỹ – Thanh toán',
    'admin': 'Quản trị hệ thống',
}
# Vai trò phạm vi toàn tập đoàn (không cần giao công ty)
GLOBAL_ROLES = ('admin', 'cfo', 'chairman', 'treasury', 'auditor')

# Quyền gán cho tài khoản nhân viên (hiển thị ở màn hình quản trị)
PERMISSIONS = [
    ('cashbook.create', 'KTV – lập Thu Chi & Vay nợ'),
    ('partner_payment.create', 'KTV – lập Thanh toán đối tác'),
    ('cash_fund.create', 'KTV – lập Quỹ TM & tạm ứng'),
    ('payroll.create', 'Nhân sự – lập Thanh toán lương'),
    ('payroll.approve', 'KTV lương – kiểm tra bảng lương (thay KTTH)'),
]


def is_admin(u):
    return u['role'] == 'admin'


def is_global(u):
    return u['role'] in GLOBAL_ROLES


def is_director(u):
    return u['role'] == 'director'


def in_scope(u, company_id):
    return is_global(u) or (company_id in u['company_ids'])


def require_scope(u, company_id):
    if not in_scope(u, company_id):
        raise ApiError(403, 'Bạn không được phân quyền cho công ty này')


def can_create(u, module):
    return f'{module.key}.create' in u['perms']


def can_check(u, module):
    """Bước 'KTTH kiểm tra hồ sơ'."""
    if u['role'] == 'chief_accountant':
        return True
    return module.l1_rule == 'perm' and u['role'] == 'staff' and f'{module.key}.approve' in u['perms']


# giữ tên cũ cho mã gọi từ nơi khác
can_l1 = can_check

APPROVER_ROLES = ('chief_accountant', 'group_chief', 'cfo', 'auditor', 'director', 'chairman', 'treasury')


def can_view_module(u, module):
    if is_global(u) or u['role'] in APPROVER_ROLES:
        return True
    return f'{module.key}.create' in u['perms'] or f'{module.key}.approve' in u['perms']


def can_view_summary(u):
    return u['role'] in ('chief_accountant', 'group_chief', 'cfo', 'auditor', 'director', 'chairman', 'treasury', 'admin')


def can_view_dashboard(u):
    return u['role'] in ('director', 'cfo', 'chairman', 'admin')


def can_view_control(u):
    return u['role'] in ('admin', 'cfo', 'auditor')


def require(cond, msg='Bạn không có quyền thực hiện thao tác này'):
    if not cond:
        raise ApiError(403, msg)
