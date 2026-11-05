"""Xóa toàn bộ dữ liệu nghiệp vụ cũ để kế toán nhập liệu mới (quyết định của Chủ tịch 05/11/2026).

Chạy:   python -m app.reset_data --yes                (Docker: docker compose exec app python -m app.reset_data --yes)
Xóa:    mọi chứng từ, lịch sử xử lý, bút toán sổ quỹ, khoản vay, TSĐB, đối chiếu dư nợ,
        tài khoản ngân hàng / quỹ tiền mặt và danh sách đối tác – nhân viên nạp từ Excel cũ.
Giữ:    tài khoản người dùng, công ty, nhóm công ty (kể cả ngưỡng N), ngân hàng, hạng mục thu chi.
Tuỳ chọn --keep-master: giữ cả tài khoản NH / quỹ và đối tác (chỉ xóa chứng từ, sổ, khoản vay).
SAO LƯU CƠ SỞ DỮ LIỆU TRƯỚC KHI CHẠY.
"""
import sys

from .db import get_db, init_schema

TABLES = ['ledger_entries', 'doc_approvals', 'doc_events', 'doc_cashbook', 'doc_partner_payment', 'doc_payroll', 'doc_cash_fund',
          'doc_loan', 'loan_collaterals', 'loan_recons', 'loans']
MASTER = ['accounts', 'partners']


def reset(keep_master=False):
    init_schema()
    counts = {}
    with get_db() as db:
        for t in TABLES + ([] if keep_master else MASTER):
            counts[t] = db.scalar(f'SELECT COUNT(*) FROM {t}')
            db.execute(f'DELETE FROM {t}')
    return counts


if __name__ == '__main__':
    if '--yes' not in sys.argv:
        print(__doc__)
        print('Thêm --yes để xác nhận xóa.')
        sys.exit(1)
    res = reset('--keep-master' in sys.argv)
    for t, n in res.items():
        print(f'  {t:22s} đã xóa {n} dòng')
    print('Hoàn tất. Dữ liệu sẵn sàng cho kế toán nhập mới.')
