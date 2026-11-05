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
        Field('loan_id', 'Khoản vay', 'loan', source='loan', show=DEBT, list=True,
              help='Chọn khoản vay đã được Chủ tịch duyệt (trang Khoản vay). Chưa có → Ngân quỹ lập Hồ sơ vay trước'),
        Field('counterparty', 'Đối tượng', 'partner', list=True, help='Bên cho vay, khách hàng, nhân viên, ngân hàng…'),
        Field('description', 'Nội dung', 'text', list=True, width=2),
        Field('category_id', 'Hạng mục', 'category', help='Bỏ trống = tự gán theo Loại'),
        Field('contract_no', 'Số HĐ vay / hóa đơn', 'text', help='Vay / trả nợ: tự lấy theo khoản vay đã chọn'),
        Field('interest_rate', 'Lãi suất %/năm', 'number', show=LOAN_IN),
        Field('maturity_date', 'Ngày đáo hạn', 'date', show=LOAN_IN),
        Field('special_type', 'Giao dịch đặc biệt', 'select', options=['Bảo lãnh', 'Bên liên quan', 'Khác (Chủ tịch duyệt)'],
              help='Vay, góp vốn tự động là giao dịch đặc biệt'),
        Field('doc_no', 'Số chứng từ', 'text'),
        Field('note', 'Ghi chú', 'textarea', width=2),
    ]
    help = [
        'Dùng cho mọi khoản thu / chi trực tiếp trên tài khoản ngân hàng hoặc quỹ tiền mặt, và các khoản vay nợ.',
        'Thu: giải ngân vay ngân hàng, nhận vay cá nhân, thu tiền khách hàng, hoàn ứng NV chuyển khoản, góp vốn, lãi tiền gửi, thu khác.',
        'Chi: trả nợ gốc vay, trả lãi vay, phí ngân hàng / SMS (phí quản lý TK, phí chuyển tiền, SMS banking), chi khác.',
        'Khoản vay: ghi Số HĐ vay, lãi suất, ngày đáo hạn. Trả gốc / lãi cũng nhập ở đây với cùng Số HĐ vay để theo dõi dư nợ.',
        'Khoản thu thông thường: KTV lập → KTTH kiểm tra, đối chiếu sổ phụ → ghi sổ.',
        'Khoản chi: KTV lập → KTTH kiểm tra → CFO kiểm soát cấp 1 → Giám đốc nhóm duyệt (trên ngưỡng N: thêm KSNB và Chủ tịch) → Ngân quỹ chi, ghi số UNC → ghi sổ.',
        'Giải ngân, trả gốc, trả lãi: bắt buộc chọn Khoản vay đã được duyệt ở Hồ sơ vay; dư nợ tự cập nhật khi chứng từ ghi sổ.',
        'Giải ngân: KTTH → CFO → Chủ tịch duyệt cuối → ghi sổ. Trả nợ đúng lịch: KTTH → CFO → Giám đốc nhóm → Chủ tịch → Ngân quỹ chi.',
        'Trả trước hạn toàn bộ khế ước: thêm KSNB kiểm tra trước. Nhận góp vốn: KTTH → CFO → KSNB → Chủ tịch.',
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
        if k in DEBT:
            e.update(self._loan_errors(doc, ctx))
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

    # ---- liên kết phân hệ Khoản vay
    def enrich(self, doc, ctx):
        ln = ctx.loans.get(doc.get('loan_id')) if doc.get('kind') in DEBT else None
        if doc.get('kind') not in DEBT:
            doc['loan_id'] = None
        if ln:
            doc['contract_no'] = ' / '.join(x for x in (ln['contract_no'], ln['drawdown_no']) if x) or ln['code']
            doc['counterparty'] = doc.get('counterparty') or ln['lender']
            if doc['kind'] in LOAN_IN:
                doc['maturity_date'] = doc.get('maturity_date') or ln['maturity_date']

    def company_of(self, doc, ctx):
        a = ctx.accounts.get(doc.get('account_id'))
        return a['company_id'] if a else None

    def _loan_errors(self, doc, ctx):
        from ..services import loans as ls
        e = {}
        ln = ctx.loans.get(doc.get('loan_id'))
        if not ln or ln['kind'] != 'loan':
            return {'loan_id': 'Chọn khoản vay đã được duyệt'}
        acc = ctx.accounts.get(doc.get('account_id'))
        if acc and acc['company_id'] != ln['company_id']:
            e['account_id'] = 'TK không thuộc công ty vay'
        amt = doc.get('amount') or 0
        mv = ls.movements(ctx.db, {ln['id']}).get(ln['id'], {})
        dis_p, rep_p = ls.pending_amounts(ctx.db, ln['id'], exclude_doc=doc.get('id'))
        out = mv.get('disbursed', 0) - mv.get('repaid', 0)
        if doc['kind'] in LOAN_IN and mv.get('disbursed', 0) + dis_p + amt > (ln['amount'] or 0):
            e['amount'] = f"Vượt số tiền vay được duyệt (còn được giải ngân {max((ln['amount'] or 0) - mv.get('disbursed', 0) - dis_p, 0):,.0f} đ)".replace(',', '.')
        if doc['kind'] == 'Trả nợ gốc vay' and amt > out - rep_p:
            e['amount'] = f'Vượt dư nợ còn lại ({max(out - rep_p, 0):,.0f} đ)'.replace(',', '.')
        if doc['kind'] == 'Trả lãi vay' and not mv.get('disbursed'):
            e['loan_id'] = 'Khoản vay chưa giải ngân'
        return e

    def custom_route(self, d, ctx):
        k = d.get('kind')
        if k not in DEBT:
            return None
        if k in LOAN_IN:
            return ['chk', 'ctl', 'chair'], 'Giải ngân theo khoản vay đã duyệt – Chủ tịch duyệt cuối'
        from ..services import loans as ls
        ln = ctx.loans.get(d.get('loan_id')) or {}
        if k == 'Trả nợ gốc vay' and ln.get('maturity_date') and d.get('doc_date') and d['doc_date'] < ln['maturity_date'] \
                and (d.get('amount') or 0) >= ls.balance(ctx.db, ln['id']):
            return ['chk', 'ctl', 'pre', 'chair', 'pay'], 'Trả trước hạn toàn bộ khế ước – KSNB kiểm tra, Chủ tịch duyệt cuối'
        has_dir = 'director' in ctx.active_roles(d.get('company_id'))
        return ['chk', 'ctl'] + (['dir'] if has_dir else []) + ['chair', 'pay'], 'Trả nợ vay – Chủ tịch duyệt cuối'

    def special(self, doc, ctx):
        if doc.get('kind') in LOAN_IN + ['Nhận góp vốn']:
            return doc['kind']
        return doc.get('special_type') or None

    def summary(self, doc):
        return f"{doc.get('kind') or ''} – {doc.get('description') or ''}"
