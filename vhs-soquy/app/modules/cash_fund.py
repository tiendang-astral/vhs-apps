from .base import Module, Field

KINDS = ['Tạm ứng quỹ TM', 'Tạm ứng nhân viên', 'Chi tiền mặt NCC nhỏ', 'Hoàn ứng nhân viên', 'Quyết toán tạm ứng',
         'Hoàn quỹ về NH', 'Chuyển nội bộ']
TWO_LEG = ['Tạm ứng quỹ TM', 'Hoàn quỹ về NH', 'Chuyển nội bộ']
OUT_ONLY = ['Tạm ứng nhân viên', 'Chi tiền mặt NCC nhỏ']
NEED_PERSON = OUT_ONLY + ['Hoàn ứng nhân viên', 'Quyết toán tạm ứng']


class CashFund(Module):
    key = 'cash_fund'
    title = 'Quỹ TM & tạm ứng'
    table = 'doc_cash_fund'
    icon = 'wallet'
    fields = [
        Field('doc_date', 'Ngày', 'date', True, list=True),
        Field('kind', 'Loại nghiệp vụ', 'select', True, options=KINDS, list=True),
        Field('from_account_id', 'TK chi ra (bị trừ tiền)', 'account', source='any', list=True,
              show=TWO_LEG + OUT_ONLY),
        Field('to_account_id', 'TK nhận vào (được cộng tiền)', 'account', source='any', list=True,
              show=TWO_LEG + ['Hoàn ứng nhân viên']),
        Field('company_id', 'Công ty (quyết toán)', 'company', show=['Quyết toán tạm ứng']),
        Field('amount', 'Số tiền', 'money', True, list=True),
        Field('person', 'Người nhận / nộp', 'partner', list=True, show=NEED_PERSON, help='Nhân viên hoặc nhà cung cấp'),
        Field('description', 'Nội dung', 'text', width=2),
        Field('category_id', 'Hạng mục', 'category', show=OUT_ONLY, help='Bỏ trống = tự gán theo loại'),
        Field('doc_no', 'Số chứng từ (PC / PT / UNC)', 'text'),
        Field('note', 'Ghi chú', 'textarea', width=2),
    ]
    help = [
        'Tạm ứng quỹ TM: Giám đốc chỉ định TK ngân hàng (của bất kỳ công ty nào) chuyển về quỹ tiền mặt → quỹ tăng, ngân hàng giảm.',
        'Tạm ứng nhân viên / Chi tiền mặt NCC nhỏ: chi từ quỹ tiền mặt, ghi tên người nhận.',
        'Hoàn ứng nhân viên: nhân viên trả lại tiền mặt vào quỹ. Quyết toán tạm ứng: nhân viên nộp chứng từ – không động tiền, chỉ giảm dư tạm ứng.',
        'Hoàn quỹ về NH: quỹ tiền mặt → TK ngân hàng. Chuyển nội bộ: giữa 2 TK bất kỳ (khác công ty sẽ ghi nhận công nợ nội bộ).',
    ]

    def company_of(self, doc, ctx):
        for k in ('from_account_id', 'to_account_id'):
            a = ctx.accounts.get(doc.get(k))
            if a:
                return a['company_id']
        if doc.get('company_id'):
            return doc['company_id']
        p = ctx.partners.get(doc.get('person') or '')
        return p['company_id'] if p else None

    def direction(self, doc):
        k = doc.get('kind')
        return 'move' if k in TWO_LEG else 'in' if k == 'Hoàn ứng nhân viên' else 'none' if k == 'Quyết toán tạm ứng' else 'out'

    def validate(self, doc, ctx):
        e = self.basic_errors(doc)
        k = doc.get('kind')
        fa, ta = doc.get('from_account_id'), doc.get('to_account_id')
        if not doc.get('amount'):
            e['amount'] = 'Số tiền phải > 0'
        need = {'Tạm ứng quỹ TM': ('bank', 'cash'), 'Hoàn quỹ về NH': ('cash', 'bank'), 'Chuyển nội bộ': (None, None),
                'Tạm ứng nhân viên': ('cash', 'x'), 'Chi tiền mặt NCC nhỏ': ('cash', 'x'), 'Hoàn ứng nhân viên': ('x', 'cash'),
                'Quyết toán tạm ứng': ('x', 'x')}.get(k)
        if need:
            for fld, acc, kind in (('from_account_id', fa, need[0]), ('to_account_id', ta, need[1])):
                if kind == 'x':
                    continue
                if not acc:
                    e[fld] = 'Bắt buộc chọn TK'
                else:
                    m = self.account_error(ctx, acc, kind)
                    if m:
                        e[fld] = m
            if fa and ta and fa == ta:
                e['to_account_id'] = 'Trùng TK chi ra'
        if k in NEED_PERSON and not doc.get('person'):
            e['person'] = 'Bắt buộc ghi người nhận / nộp'
        if k == 'Quyết toán tạm ứng' and not self.company_of(doc, ctx):
            e['company_id'] = 'Chọn công ty (hoặc khai báo công ty của nhân viên)'
        return e

    def category(self, doc, ctx):
        if doc.get('category_id'):
            return doc['category_id']
        k = doc['kind']
        if k in ('Tạm ứng nhân viên', 'Hoàn ứng nhân viên', 'Quyết toán tạm ứng'):
            return ctx.cat_id('Tạm ứng / hoàn ứng')
        if k == 'Chi tiền mặt NCC nhỏ':
            return ctx.cat_id('Thanh toán NCC / tiền hàng')
        return ctx.cat_id('Điều chuyển nội bộ')

    def lines(self, doc, ctx):
        k, amt, cat = doc['kind'], doc['amount'], self.category(doc, ctx)
        desc = k + (f" – {doc['description']}" if doc.get('description') else '')
        fa, ta = doc.get('from_account_id'), doc.get('to_account_id')
        out = []
        if fa and k != 'Quyết toán tạm ứng':
            cp = f"Sang {ctx.accounts[ta]['code']}" if ta else doc.get('person')
            out.append(dict(account_id=fa, amount_in=0, amount_out=amt, category_id=cat, counterparty=cp, description=desc))
        if ta:
            cp = f"Từ {ctx.accounts[fa]['code']}" if fa else doc.get('person')
            out.append(dict(account_id=ta, amount_in=amt, amount_out=0, category_id=cat, counterparty=cp, description=desc))
        return out

    def summary(self, doc):
        return f"{doc.get('kind') or ''} – {doc.get('person') or doc.get('description') or ''}"
