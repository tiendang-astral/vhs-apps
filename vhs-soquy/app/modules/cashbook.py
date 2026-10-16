from .base import Module, Field

THU = ['Giải ngân vay ngân hàng', 'Nhận vay cá nhân', 'Thu tiền khách hàng', 'Hoàn ứng NV (chuyển khoản)', 'Nhận góp vốn',
       'Lãi tiền gửi', 'Thu khác']
CHI = ['Trả nợ gốc vay', 'Trả lãi vay', 'Phí ngân hàng / SMS', 'Chi khác']
LOAN_IN = ['Giải ngân vay ngân hàng', 'Nhận vay cá nhân']
DEBT = LOAN_IN + ['Trả nợ gốc vay', 'Trả lãi vay']
DEFAULT_CAT = {'Giải ngân vay ngân hàng': 'Vay / giải ngân', 'Nhận vay cá nhân': 'Vay / giải ngân',
               'Thu tiền khách hàng': 'Tiền hàng / doanh thu', 'Hoàn ứng NV (chuyển khoản)': 'Tạm ứng / hoàn ứng',
               'Nhận góp vốn': 'Góp vốn / đầu tư', 'Lãi tiền gửi': 'Lãi tiền gửi', 'Thu khác': 'Khác',
               'Trả nợ gốc vay': 'Trả nợ gốc vay', 'Trả lãi vay': 'Trả lãi vay', 'Phí ngân hàng / SMS': 'Phí ngân hàng',
               'Chi khác': 'Khác'}


class Cashbook(Module):
    key = 'cashbook'
    title = 'Thu Chi & Vay nợ'
    table = 'doc_cashbook'
    icon = 'swap'
    fields = [
        Field('doc_date', 'Ngày', 'date', True, list=True),
        Field('kind', 'Loại', 'select', True, options=THU + CHI, list=True),
        Field('account_id', 'TK nhận / chi', 'account', True, source='scope', list=True),
        Field('amount', 'Số tiền', 'money', True, list=True),
        Field('counterparty', 'Đối tượng', 'partner', list=True, help='Bên cho vay, khách hàng, nhân viên, ngân hàng…'),
        Field('description', 'Nội dung', 'text', list=True, width=2),
        Field('category_id', 'Hạng mục', 'category', help='Bỏ trống = tự gán theo Loại'),
        Field('contract_no', 'Số HĐ vay / hóa đơn', 'text', help='Bắt buộc với vay / trả nợ'),
        Field('interest_rate', 'Lãi suất %/năm', 'number', show=LOAN_IN),
        Field('maturity_date', 'Ngày đáo hạn', 'date', show=LOAN_IN),
        Field('doc_no', 'Số chứng từ', 'text'),
        Field('note', 'Ghi chú', 'textarea', width=2),
    ]
    help = [
        'Dùng cho mọi khoản thu / chi trực tiếp trên tài khoản ngân hàng hoặc quỹ tiền mặt, và các khoản vay nợ.',
        'Thu: giải ngân vay ngân hàng, nhận vay cá nhân, thu tiền khách hàng, hoàn ứng NV chuyển khoản, góp vốn, lãi tiền gửi, thu khác.',
        'Chi: trả nợ gốc vay, trả lãi vay, phí ngân hàng / SMS (phí quản lý TK, phí chuyển tiền, SMS banking), chi khác.',
        'Khoản vay: ghi Số HĐ vay, lãi suất, ngày đáo hạn. Trả gốc / lãi cũng nhập ở đây với cùng Số HĐ vay để theo dõi dư nợ.',
        'Lưu → Gửi duyệt → Kế toán trưởng duyệt → GĐ công ty trụ cột duyệt → Admin tập đoàn duyệt cuối → hệ thống tự ghi sổ và cập nhật báo cáo.',
    ]

    def direction(self, doc):
        return 'out' if doc.get('kind') in CHI else 'in'

    def validate(self, doc, ctx):
        e = self.basic_errors(doc)
        if doc.get('account_id') and 'account_id' not in e:
            m = self.account_error(ctx, doc['account_id'])
            if m:
                e['account_id'] = m
        if not doc.get('amount'):
            e['amount'] = 'Số tiền phải > 0'
        k = doc.get('kind')
        if k in LOAN_IN + ['Hoàn ứng NV (chuyển khoản)'] and not doc.get('counterparty'):
            e['counterparty'] = 'Bắt buộc với loại này'
        if k in DEBT and not doc.get('contract_no'):
            e['contract_no'] = 'Bắt buộc ghi Số HĐ vay'
        if doc.get('category_id') and doc['category_id'] not in ctx.cat_by_id:
            e['category_id'] = 'Hạng mục không tồn tại'
        return e

    def lines(self, doc, ctx):
        cat = doc.get('category_id') or ctx.cat_id(DEFAULT_CAT.get(doc['kind'], 'Khác'))
        amt = doc['amount']
        desc = doc['kind'] + (f" – HĐ {doc['contract_no']}" if doc.get('contract_no') else '') + \
            (f" – {doc['description']}" if doc.get('description') else '')
        out = self.direction(doc) == 'out'
        return [dict(account_id=doc['account_id'], amount_in=0 if out else amt, amount_out=amt if out else 0,
                     category_id=cat, counterparty=doc.get('counterparty'), description=desc)]

    def summary(self, doc):
        return f"{doc.get('kind') or ''} – {doc.get('description') or ''}"
