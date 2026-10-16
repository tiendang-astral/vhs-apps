from .base import Module, Field


class PartnerPayment(Module):
    key = 'partner_payment'
    title = 'Thanh toán đối tác'
    table = 'doc_partner_payment'
    icon = 'handshake'
    fields = [
        Field('doc_date', 'Ngày thanh toán', 'date', True, list=True),
        Field('account_id', 'TK thanh toán', 'account', True, source='scope', list=True,
              help='TK ngân hàng = chuyển khoản; quỹ TM-xxx = trả tiền mặt'),
        Field('partner', 'Đối tác', 'partner', True, list=True),
        Field('amount', 'Số tiền', 'money', True, list=True),
        Field('description', 'Nội dung', 'text', True, list=True, width=2),
        Field('invoice_no', 'Số HĐ / hóa đơn', 'text', list=True),
        Field('category_id', 'Hạng mục', 'category', help='Bỏ trống = Thanh toán NCC / tiền hàng'),
        Field('due_date', 'Hạn thanh toán', 'date'),
        Field('requested_by', 'Người đề nghị', 'text'),
        Field('doc_no', 'Số chứng từ (UNC / PC)', 'text'),
        Field('note', 'Ghi chú', 'textarea', width=2),
    ]
    help = [
        'Kế toán lập đề nghị thanh toán cho đối tác (chuyển khoản hoặc tiền mặt).',
        'Chứng từ chưa duyệt xong được theo dõi như công nợ chờ trả (có cảnh báo quá hạn theo Hạn thanh toán).',
        'Sau khi Admin tập đoàn duyệt cuối, khoản chi tự ghi vào TK thanh toán và cập nhật báo cáo.',
    ]

    def validate(self, doc, ctx):
        e = self.basic_errors(doc)
        if doc.get('account_id') and 'account_id' not in e:
            m = self.account_error(ctx, doc['account_id'])
            if m:
                e['account_id'] = m
        if not doc.get('amount'):
            e['amount'] = 'Số tiền phải > 0'
        return e

    def lines(self, doc, ctx):
        cat = doc.get('category_id') or ctx.cat_id('Thanh toán NCC / tiền hàng')
        desc = (doc.get('description') or '') + (f" – HĐ {doc['invoice_no']}" if doc.get('invoice_no') else '')
        return [dict(account_id=doc['account_id'], amount_in=0, amount_out=doc['amount'], category_id=cat,
                     counterparty=doc.get('partner'), description=desc)]

    def summary(self, doc):
        return f"{doc.get('partner') or ''} – {doc.get('description') or ''}"
