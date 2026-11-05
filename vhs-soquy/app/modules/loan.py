"""Hồ sơ vay – Phân hệ Khoản vay.

Mọi thay đổi về khoản vay đều qua một hồ sơ có tuyến duyệt, Chủ tịch duyệt cuối:
- Hạn mức tín dụng, Hợp đồng vay / khế ước, Gia hạn – cơ cấu, Tài sản bảo đảm – bảo lãnh:
  KTTH → CFO → KSNB → Chủ tịch.
- Điều chỉnh lãi suất, Đối chiếu dư nợ: KTTH → CFO → Chủ tịch.
Khi hồ sơ được duyệt, phân hệ Khoản vay tự cập nhật sổ khoản vay (services/loans.py).
Hồ sơ không phát sinh tiền; tiền giải ngân / trả nợ đi qua nghiệp vụ Thu Chi & Vay nợ (chọn khoản vay).
"""
from .base import Module, Field

K_LIMIT = 'Hạn mức tín dụng'
K_LOAN = 'Hợp đồng vay / khế ước'
K_EXTEND = 'Gia hạn / cơ cấu nợ'
K_RATE = 'Điều chỉnh lãi suất'
K_COLL = 'Tài sản bảo đảm / bảo lãnh'
K_RECON = 'Đối chiếu dư nợ'
KINDS = [K_LOAN, K_LIMIT, K_EXTEND, K_RATE, K_COLL, K_RECON]
NEW = [K_LIMIT, K_LOAN]
ON_LOAN = [K_EXTEND, K_RATE, K_COLL, K_RECON]
LENDER_TYPES = ['Ngân hàng', 'Tổ chức tín dụng khác', 'Cá nhân', 'Công ty trong Group', 'Tổ chức khác']
REPAY = ['Trả gốc một lần cuối kỳ', 'Trả gốc đều hằng tháng', 'Theo lịch của ngân hàng']


class LoanDossier(Module):
    key = 'loan'
    title = 'Hồ sơ vay'
    table = 'doc_loan'
    icon = 'bank'
    l1_label = 'KTTH'
    fields = [
        Field('doc_date', 'Ngày hồ sơ', 'date', True, list=True),
        Field('kind', 'Loại hồ sơ', 'select', True, options=KINDS, list=True),
        Field('company_id', 'Công ty vay', 'company', show=NEW, list=True),
        Field('loan_id', 'Khoản vay', 'loan', source='loan', show=ON_LOAN, list=True,
              help='Chọn khoản vay hoặc hạn mức đã được duyệt'),
        Field('code', 'Mã khoản vay / hạn mức', 'text', show=NEW, list=True, help='VD: VAY-VHS-2611-01, HM-DP-VPB-2026'),
        Field('lender', 'Bên cho vay', 'text', show=NEW, list=True, help='Tên ngân hàng / tổ chức / cá nhân'),
        Field('lender_type', 'Loại bên cho vay', 'select', show=NEW, options=LENDER_TYPES),
        Field('contract_no', 'Số hợp đồng tín dụng', 'text', show=NEW),
        Field('drawdown_no', 'Số khế ước nhận nợ', 'text', show=[K_LOAN]),
        Field('limit_id', 'Thuộc hạn mức', 'loan', source='limit', show=[K_LOAN], help='Bỏ trống nếu là hợp đồng vay riêng lẻ'),
        Field('term', 'Kỳ hạn', 'select', show=[K_LOAN], options=['Ngắn hạn', 'Dài hạn']),
        Field('limit_amount', 'Tổng hạn mức', 'money', show=[K_LIMIT]),
        Field('amount', 'Số tiền vay', 'money', show=[K_LOAN]),
        Field('start_date', 'Ngày hiệu lực / giải ngân dự kiến', 'date', show=NEW),
        Field('maturity_date', 'Ngày đáo hạn', 'date', show=NEW),
        Field('rate', 'Lãi suất %/năm', 'number', show=[K_LOAN]),
        Field('rate_type', 'Loại lãi suất', 'select', show=[K_LOAN], options=['Cố định', 'Thả nổi']),
        Field('interest_day', 'Ngày trả lãi hằng tháng', 'number', show=[K_LOAN]),
        Field('repay_method', 'Cách trả gốc', 'select', show=[K_LOAN], options=REPAY),
        Field('new_maturity', 'Ngày đáo hạn mới', 'date', show=[K_EXTEND]),
        Field('new_rate', 'Lãi suất mới %/năm', 'number', show=[K_EXTEND, K_RATE]),
        Field('effective_date', 'Ngày áp dụng', 'date', show=[K_RATE]),
        Field('collateral', 'Tài sản bảo đảm / bên bảo lãnh', 'textarea', show=[K_LIMIT, K_LOAN, K_COLL], width=2),
        Field('owner_company_id', 'Công ty sở hữu TSĐB / bảo lãnh', 'company', show=[K_COLL],
              help='Khác công ty vay = bảo lãnh chéo giữa các công ty'),
        Field('collateral_value', 'Giá trị TSĐB / bảo lãnh', 'money', show=[K_COLL]),
        Field('insurance_expiry', 'Hạn bảo hiểm TSĐB', 'date', show=[K_COLL]),
        Field('period', 'Tháng đối chiếu', 'month', show=[K_RECON]),
        Field('bank_balance', 'Dư nợ theo ngân hàng', 'money', show=[K_RECON], help='Theo thông báo / xác nhận dư nợ của ngân hàng'),
        Field('description', 'Mục đích / nội dung', 'text', list=True, width=2),
        Field('doc_no', 'Số tờ trình / văn bản', 'text'),
        Field('note', 'Ghi chú (ý kiến KTTH, Kế toán thuế…)', 'textarea', width=2),
    ]
    help = [
        'Ngân quỹ lập hồ sơ cho mọi thay đổi về khoản vay: hạn mức, hợp đồng / khế ước mới, gia hạn, đổi lãi suất, tài sản bảo đảm, đối chiếu dư nợ.',
        'Tuyến duyệt: KTTH → CFO → KSNB kiểm tra trước → Chủ tịch duyệt cuối (đổi lãi suất, đối chiếu dư nợ không qua KSNB).',
        'Hồ sơ được duyệt → khoản vay xuất hiện ở trang Khoản vay và được chọn khi lập chứng từ giải ngân, trả nợ ở Thu Chi & Vay nợ.',
        'Dư nợ không nhập tay: dư nợ = giải ngân đã ghi sổ − trả gốc đã ghi sổ. Chênh lệch với ngân hàng lập hồ sơ Đối chiếu dư nợ.',
    ]

    def normalize(self, data):
        doc = super().normalize(data)
        if doc.get('code'):
            doc['code'] = doc['code'].upper()
        return doc

    def company_of(self, doc, ctx):
        if doc.get('kind') in NEW:
            return doc.get('company_id')
        ln = ctx.loans.get(doc.get('loan_id'))
        return ln['company_id'] if ln else None

    def direction(self, doc):
        return 'none'

    def amount(self, doc):
        k = doc.get('kind')
        return {K_LIMIT: doc.get('limit_amount'), K_LOAN: doc.get('amount'), K_COLL: doc.get('collateral_value'),
                K_RECON: doc.get('bank_balance')}.get(k) or 0

    def custom_route(self, doc, ctx):
        if doc.get('kind') in (K_RATE, K_RECON):
            return ['chk', 'ctl', 'chair'], 'Hồ sơ vay – Chủ tịch duyệt cuối'
        return ['chk', 'ctl', 'pre', 'chair'], 'Hồ sơ vay – giao dịch đặc biệt, Chủ tịch duyệt cuối'

    def validate(self, doc, ctx):
        e = self.basic_errors(doc)
        k = doc.get('kind')
        if k in NEW:
            for f in ('company_id', 'code', 'lender', 'lender_type', 'maturity_date'):
                if not doc.get(f):
                    e[f] = 'Bắt buộc nhập'
            if doc.get('code'):
                other = ctx.loans_by_code.get(doc['code'])
                if other and other.get('source_doc_id') != doc.get('id'):
                    e['code'] = 'Mã đã tồn tại'
            if doc.get('start_date') and doc.get('maturity_date') and doc['maturity_date'] < doc['start_date']:
                e['maturity_date'] = 'Trước ngày hiệu lực'
        if k == K_LIMIT and not doc.get('limit_amount'):
            e['limit_amount'] = 'Phải > 0'
        if k == K_LOAN:
            for f in ('amount', 'term', 'repay_method'):
                if not doc.get(f):
                    e[f] = 'Bắt buộc nhập'
            r = doc.get('rate')
            if r is not None and not 0 <= r <= 40:
                e['rate'] = 'Lãi suất 0–40%/năm'
            d = doc.get('interest_day')
            if d is not None and not 1 <= d <= 31:
                e['interest_day'] = 'Từ 1 đến 31'
            lim = ctx.loans.get(doc.get('limit_id'))
            if doc.get('limit_id') and (not lim or lim['kind'] != 'limit'):
                e['limit_id'] = 'Hạn mức không hợp lệ'
            elif lim and lim['company_id'] != doc.get('company_id'):
                e['limit_id'] = 'Hạn mức của công ty khác'
        if k in ON_LOAN:
            ln = ctx.loans.get(doc.get('loan_id'))
            if not ln:
                e['loan_id'] = 'Chọn khoản vay đã duyệt'
            elif k in (K_RATE, K_RECON) and ln['kind'] != 'loan':
                e['loan_id'] = 'Chọn khoản vay (không phải hạn mức)'
            if k == K_EXTEND and not doc.get('new_maturity') and doc.get('new_rate') is None:
                e['new_maturity'] = 'Nhập ngày đáo hạn mới hoặc lãi suất mới'
            if k == K_RATE:
                if doc.get('new_rate') is None:
                    e['new_rate'] = 'Bắt buộc nhập'
                if not doc.get('effective_date'):
                    e['effective_date'] = 'Bắt buộc nhập'
            if k == K_COLL and not doc.get('collateral'):
                e['collateral'] = 'Mô tả tài sản / bên bảo lãnh'
            if k == K_RECON:
                if not doc.get('period'):
                    e['period'] = 'Bắt buộc nhập'
                if doc.get('bank_balance') is None:
                    e['bank_balance'] = 'Bắt buộc nhập (có thể là 0)'
        return e

    def summary(self, doc):
        return f"{doc.get('kind') or ''} – {doc.get('code') or doc.get('loan_code') or ''} {doc.get('description') or ''}".strip()

    # ---- cập nhật sổ khoản vay khi duyệt xong / mở lại
    def on_posted(self, db, doc, ctx, user):
        from ..services import loans as ls
        ls.apply_dossier(db, doc, ctx)

    def on_unposted(self, db, doc, ctx, user):
        from ..services import loans as ls
        ls.revert_dossier(db, doc)
