"""Nội dung trang Hướng dẫn nhập liệu (thay cho sheet Hướng dẫn của file Excel)."""
from ..modules import REGISTRY

GENERAL = [
    {'title': 'Quy trình chung', 'items': [
        'Mọi khoản thu / chi đều qua các bước: Lập chứng từ → Duyệt cấp 1 → Giám đốc công ty trụ cột (Admin 2) duyệt cấp 2 → Admin tập đoàn duyệt cuối. Chỉ khi Admin tập đoàn duyệt, hệ thống mới ghi sổ và cập nhật báo cáo.',
        'Thanh toán lương: Nhân sự lập (nhập tay hoặc tải lên biểu mẫu Excel) → Kế toán duyệt lương → GĐ công ty trụ cột → Admin tập đoàn.',
        'Các nghiệp vụ khác (Thu Chi & Vay nợ, Thanh toán đối tác, Quỹ TM & tạm ứng): Kế toán lập → Kế toán trưởng → GĐ công ty trụ cột → Admin tập đoàn.',
        'Nhóm công ty chưa có tài khoản GĐ công ty trụ cột thì chứng từ chuyển thẳng từ duyệt cấp 1 lên Admin tập đoàn.',
        'Chứng từ ở trạng thái Nháp: người lập được sửa / xóa. Sau khi bấm "Gửi duyệt" thì không sửa được nữa.',
        'Phát hiện sai sau khi đã gửi: bấm "Đề nghị mở lại" và ghi lý do. Chỉ Admin tập đoàn được mở lại cho người lập sửa (Kế toán trưởng, GĐ công ty trụ cột không có quyền này). Nếu chứng từ đã ghi sổ, mở lại sẽ tự hủy bút toán.',
        'Người lập không được tự duyệt chứng từ của chính mình.',
    ]},
    {'title': 'Dữ liệu khai báo', 'items': [
        'Mọi tài khoản đều được thêm / sửa / xóa danh mục (công ty, ngân hàng, tài khoản, hạng mục, đối tác & nhân viên) khi còn ở trạng thái Nháp.',
        'Khai báo xong bấm "Khóa (Submit)": dữ liệu không sửa / xóa được nữa. Chỉ Admin tập đoàn mở khóa được.',
        'Quỹ tiền mặt: Loại quỹ = Tiền mặt, không chọn ngân hàng, ghi tên thủ quỹ. Mã TK nên đặt TM-<mã công ty>.',
        'Nhân viên cần khai báo ở "Đối tác & nhân viên" (Loại = Nhân viên, có công ty) để theo dõi tạm ứng và lương.',
    ]},
    {'title': 'Báo cáo & quyền xem', 'items': [
        'Nhân viên: xem nghiệp vụ được giao + Chi tiết theo ngày / tháng của các công ty phụ trách.',
        'Kế toán trưởng: duyệt cấp 1, xem Chi tiết và Tổng hợp theo ngày / tháng của các công ty phụ trách.',
        'GĐ công ty trụ cột (Admin 2): duyệt cấp 2, xem Dashboard, Chi tiết và Tổng hợp của các công ty trong nhóm trụ cột.',
        'Admin tập đoàn: xem toàn bộ các công ty, Dashboard toàn tập đoàn (lọc được theo nhóm), Kiểm soát hạch toán, quản trị tài khoản.',
        '"Thu / chi thực" trên báo cáo đã loại các khoản Nội bộ (chuyển tiền giữa các TK, rút / nộp tiền mặt).',
    ]},
]


def guide():
    return {'general': GENERAL, 'modules': [{'title': m.title, 'items': m.help} for m in REGISTRY.values()]}
