from .base import Module, Field

MONEY = ['gross', 'bonus', 'insurance', 'pit', 'advance_deduction', 'other_deduction']


class Payroll(Module):
    key = 'payroll'
    title = 'Thanh toán lương'
    table = 'doc_payroll'
    icon = 'users'
    l1_rule = 'perm'
    l1_label = 'Kế toán duyệt lương'
    importable = True
    import_fields = ['period', 'company_id', 'employee', 'department', 'gross', 'bonus', 'insurance', 'pit',
                     'advance_deduction', 'other_deduction', 'doc_date', 'account_id', 'doc_no', 'note']
    fields = [
        Field('period', 'Kỳ lương', 'month', True, list=True),
        Field('employee', 'Nhân viên', 'partner', True, source='employee', list=True),
        Field('company_id', 'Công ty hạch toán lương', 'company', True, list=True),
        Field('department', 'Bộ phận', 'text'),
        Field('gross', 'Lương + phụ cấp', 'money', True),
        Field('bonus', 'Thưởng', 'money'),
        Field('insurance', 'BHXH, BHYT (NLĐ)', 'money'),
        Field('pit', 'Thuế TNCN', 'money'),
        Field('advance_deduction', 'Trừ tạm ứng', 'money', help='Tự giảm dư tạm ứng của nhân viên'),
        Field('other_deduction', 'Khấu trừ khác', 'money'),
        Field('net', 'Thực lĩnh', 'money', computed=True, list=True),
        Field('doc_date', 'Ngày chi trả', 'date', True, list=True),
        Field('account_id', 'TK chi trả', 'account', True, source='any', list=True,
              help='TK ngân hàng = chuyển khoản; quỹ TM-xxx = tiền mặt'),
        Field('doc_no', 'Số chứng từ', 'text'),
        Field('note', 'Ghi chú', 'textarea', width=2),
    ]
    help = [
        'Tài khoản Nhân sự lập bảng lương: mỗi nhân viên / kỳ lương 1 chứng từ. Thực lĩnh tự tính.',
        'Nhập nhiều nhân viên cùng lúc: bấm "Tải biểu mẫu Excel", điền mỗi nhân viên 1 dòng, rồi "Nhập từ Excel". '
        'Hệ thống kiểm tra từng dòng (công ty, TK chi trả, số tiền, trùng kỳ lương) trước khi tạo chứng từ.',
        'Quy trình: Nhân sự lập → Kế toán duyệt lương → Giám đốc công ty trụ cột duyệt → Admin tập đoàn duyệt cuối → ghi sổ.',
        'Cột Trừ tạm ứng tự giảm số tiền nhân viên đang nợ tạm ứng.',
        'BHXH / thuế khấu trừ khi nộp Nhà nước → lập ở Thanh toán đối tác.',
    ]

    def net(self, doc):
        g = lambda k: doc.get(k) or 0
        return g('gross') + g('bonus') - g('insurance') - g('pit') - g('advance_deduction') - g('other_deduction')

    def company_of(self, doc, ctx):
        return doc.get('company_id')

    def duplicate_key(self, doc):
        return (doc.get('company_id'), doc.get('period'), (doc.get('employee') or '').strip().lower())

    def validate(self, doc, ctx):
        e = self.basic_errors(doc)
        if doc.get('account_id') and 'account_id' not in e:
            m = self.account_error(ctx, doc['account_id'])
            if m:
                e['account_id'] = m
        if self.net(doc) <= 0:
            e['gross'] = 'Thực lĩnh phải > 0'
        return e

    def lines(self, doc, ctx):
        p = doc['period']
        return [dict(account_id=doc['account_id'], amount_in=0, amount_out=self.net(doc), category_id=ctx.cat_id('Lương, thưởng'),
                     counterparty=doc.get('employee'),
                     description=f"Lương {p[5:7]}/{p[:4]}" + (f" – {doc['department']}" if doc.get('department') else ''))]

    def amount(self, doc):
        return self.net(doc)

    def summary(self, doc):
        p = doc.get('period') or ''
        return f"Lương {p[5:7]}/{p[:4]} – {doc.get('employee') or ''}"
