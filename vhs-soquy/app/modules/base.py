"""Khung chung cho 1 nghiệp vụ (chứng từ có quy trình duyệt và bút toán ghi sổ).

Thêm nghiệp vụ mới = viết 1 lớp con của Module (khai báo field, kiểm tra, cách ghi sổ) rồi đăng ký trong modules/__init__.py.
API, giao diện nhập liệu, danh sách, duyệt, ghi sổ, báo cáo đều dùng lại tự động.
"""
import re
from dataclasses import dataclass, field as dfield

DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


@dataclass
class Field:
    name: str
    label: str
    type: str = 'text'          # text|textarea|date|month|money|number|select|account|category|partner|company
    required: bool = False
    options: list = None        # cho select
    source: str = None          # account: 'scope' (TK công ty mình) | 'any';  partner: 'employee' | None
    account_kind: str = None    # 'cash' | 'bank' | None
    show: list = None           # chỉ hiện khi kind thuộc danh sách
    help: str = ''
    list: bool = False          # hiện ở bảng danh sách
    width: int = 1              # 1 | 2 (chiếm 2 cột trong form)
    computed: bool = False      # chỉ đọc (tính tự động)

    def meta(self):
        d = {k: v for k, v in self.__dict__.items() if v not in (None, False, '')}
        return d


class Ctx:
    """Bộ nhớ đệm danh mục dùng khi kiểm tra / ghi sổ (nạp 1 lần mỗi request)."""

    def __init__(self, db):
        self.db = db
        self.accounts = {r['id']: r for r in db.all('SELECT id, code, company_id, kind, status FROM accounts')}
        cats = db.all('SELECT id, name, nature FROM categories')
        self.cat_by_id = {r['id']: r for r in cats}
        self.cat_by_name = {r['name']: r for r in cats}
        self.partners = {r['name']: r for r in db.all('SELECT name, type, company_id FROM partners')}

    def cat_id(self, name):
        c = self.cat_by_name.get(name)
        return c['id'] if c else None

    @property
    def director_companies(self):
        """Công ty có Giám đốc công ty trụ cột (Admin 2) đang hoạt động → chứng từ phải qua bước duyệt cấp 2."""
        if not hasattr(self, '_dir_cos'):
            self._dir_cos = {r['company_id'] for r in self.db.all(
                "SELECT uc.company_id FROM user_companies uc JOIN users u ON u.id=uc.user_id WHERE u.role='director' AND u.active=1")}
        return self._dir_cos


def to_int(v):
    if v in (None, ''):
        return None
    if isinstance(v, (int, float)):
        return int(round(v))
    s = re.sub(r'[^\d\-]', '', str(v))
    return int(s) if s not in ('', '-') else None


def to_float(v):
    if v in (None, ''):
        return None
    try:
        return float(str(v).replace(',', '.'))
    except ValueError:
        return None


class Module:
    key = ''
    title = ''
    table = ''
    icon = 'doc'
    l1_rule = 'chief'           # 'chief' = Kế toán trưởng duyệt cấp 1;  'perm' = nhân viên có quyền <key>.approve
    l1_label = 'Kế toán trưởng'
    fields: list = []
    help: list = []
    importable = False          # True = có biểu mẫu Excel để nhập hàng loạt
    import_fields: list = None  # thứ tự cột trong biểu mẫu (mặc định: mọi trường không tính toán)

    # ---------- chuẩn hoá dữ liệu nhập
    def normalize(self, data):
        out = {}
        for f in self.fields:
            if f.computed:
                continue
            v = data.get(f.name)
            if f.type in ('money',):
                v = to_int(v)
            elif f.type == 'number':
                v = to_float(v)
            elif f.type in ('account', 'category', 'company'):
                v = to_int(v)
            elif f.type == 'month':
                v = (str(v)[:7] + '-01') if v else None
            elif isinstance(v, str):
                v = v.strip() or None
            if f.show and data.get('kind') not in f.show:
                v = None
            out[f.name] = v
        return out

    def basic_errors(self, doc):
        err = {}
        for f in self.fields:
            if f.computed:
                continue
            if f.show and doc.get('kind') not in f.show:
                continue
            v = doc.get(f.name)
            if f.required and v in (None, ''):
                err[f.name] = 'Bắt buộc nhập'
            elif f.type in ('date', 'month') and v and not DATE_RE.match(str(v)):
                err[f.name] = 'Ngày không hợp lệ'
            elif f.type == 'money' and v is not None and v < 0:
                err[f.name] = 'Không được âm'
            elif f.type == 'select' and v and f.options and v not in f.options:
                err[f.name] = 'Giá trị không hợp lệ'
        return err

    def account_error(self, ctx, acc_id, need_kind=None):
        a = ctx.accounts.get(acc_id)
        if not a:
            return 'Tài khoản không tồn tại'
        if a['status'] != 'active':
            return 'Tài khoản đang tạm khóa / đã đóng'
        if need_kind and a['kind'] != need_kind:
            return 'Phải là quỹ tiền mặt' if need_kind == 'cash' else 'Phải là tài khoản ngân hàng'
        return None

    # ---------- phải cài đặt ở lớp con
    def company_of(self, doc, ctx):
        a = ctx.accounts.get(doc.get('account_id'))
        return a['company_id'] if a else None

    def doc_date(self, doc):
        return doc.get('doc_date')

    def duplicate_key(self, doc):
        """Khóa phát hiện chứng từ trùng khi nhập Excel (None = không kiểm tra)."""
        return None

    def validate(self, doc, ctx):
        return {}

    def lines(self, doc, ctx):
        """Bút toán khi duyệt xong: list of dict(account_id, amount_in, amount_out, category_id, counterparty, description)."""
        return []

    def amount(self, doc):
        return doc.get('amount') or 0

    def direction(self, doc):
        """in = tiền vào, out = tiền ra, move = chuyển giữa 2 TK, none = không phát sinh tiền."""
        return 'out'

    def summary(self, doc):
        return doc.get('description') or ''

    def meta(self):
        return {'key': self.key, 'title': self.title, 'icon': self.icon, 'l1_rule': self.l1_rule, 'l1_label': self.l1_label,
                'fields': [f.meta() for f in self.fields], 'help': self.help, 'importable': self.importable}
