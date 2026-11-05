"""Nội dung trang Hướng dẫn nhập liệu (thay cho sheet Hướng dẫn của file Excel)."""
from ..modules import REGISTRY

GENERAL = [
    {'title': 'Luồng duyệt chung (theo mô hình kế toán mới)', 'items': [
        'Khi bấm "Gửi duyệt", hệ thống tự lập tuyến duyệt cho chứng từ, hiển thị ở khung "Tuyến duyệt" trong chi tiết chứng từ.',
        'Khoản chi thông thường đến ngưỡng N: KTV lập → KTTH kiểm tra hồ sơ → CFO kiểm soát cấp 1 → Giám đốc nhóm duyệt → Ngân quỹ chi trên ngân hàng, ghi số UNC → hệ thống ghi sổ.',
        'Khoản chi trên ngưỡng N: KTTH → CFO → KSNB kiểm tra trước → Giám đốc nhóm → Chủ tịch → Ngân quỹ chi.',
        'Giao dịch đặc biệt (vay, góp vốn, chuyển nguồn giữa hai pháp nhân, NCC mới, bên liên quan như VHS – Đức Phát / Mai Phát Ngọc, ngoại tệ nhập thiết bị, bảo lãnh): KTTH → CFO → KSNB → Chủ tịch; Giám đốc nhóm không duyệt.',
        'Khoản thu thông thường (thu tiền khách hàng, lãi tiền gửi…): KTV lập → KTTH kiểm tra, đối chiếu sổ phụ → ghi sổ.',
        'Ngưỡng N đặt cho từng nhóm công ty ở Dữ liệu khai báo → Nhóm công ty (mặc định 200.000.000 đ).',
        'Giai đoạn 2 có Kế toán trưởng nhóm: KTT nhóm kiểm soát cấp 1 khoản đến N; khoản trên N và giao dịch đặc biệt vẫn do CFO.',
        'Công ty chưa có tài khoản Giám đốc nhóm: bước Giám đốc nhóm được thay bằng Chủ tịch.',
    ]},
    {'title': 'Khoản vay (Chủ tịch duyệt cuối mọi tuyến)', 'items': [
        'Mọi thay đổi về khoản vay đi qua Hồ sơ vay do Ngân quỹ lập: hạn mức, hợp đồng / khế ước, gia hạn – cơ cấu, tài sản bảo đảm: KTTH → CFO → KSNB → Chủ tịch; đổi lãi suất, đối chiếu dư nợ: KTTH → CFO → Chủ tịch.',
        'Giải ngân, trả gốc, trả lãi lập ở Thu Chi & Vay nợ, bắt buộc chọn Khoản vay đã duyệt. Giải ngân: KTTH → CFO → Chủ tịch. Trả nợ: KTTH → CFO → Giám đốc nhóm → Chủ tịch → Ngân quỹ chi.',
        'Trả trước hạn = trả toàn bộ khế ước trước ngày đáo hạn: thêm bước KSNB kiểm tra trước.',
        'Dư nợ không nhập tay: dư nợ = giải ngân − trả gốc đã ghi sổ. Trang Khoản vay có Dashboard, lịch trả nợ 90 ngày, cảnh báo, bảo lãnh chéo.',
    ]},
    {'title': 'Quy tắc kiểm soát', 'items': [
        'Người lập không tự duyệt chứng từ của mình. Mỗi người chỉ duyệt một bước trên cùng một chứng từ.',
        'Người duyệt thấy sai: bấm "Trả lại" và ghi lý do – chứng từ về Nháp cho người lập sửa và gửi lại từ đầu.',
        'Ngân quỹ chỉ bấm "Xác nhận đã chi & ghi sổ" sau khi lệnh trên ngân hàng đã thực hiện, và bắt buộc ghi số UNC / mã giao dịch.',
        'Sau khi gửi duyệt, chứng từ không sửa được. Phát hiện sai sau khi đã ghi sổ: bấm "Đề nghị mở lại", ghi lý do; chỉ Quản trị hệ thống mở lại hoặc hủy. Mở lại chứng từ đã ghi sổ sẽ tự hủy bút toán.',
        'KSNB hậu kiểm chứng từ đã ghi sổ ở tab "Chờ hậu kiểm"; bấm "Đã hậu kiểm" và ghi nhận xét.',
    ]},
    {'title': 'Dữ liệu khai báo', 'items': [
        'Mọi tài khoản đều được thêm / sửa / xóa danh mục (công ty, ngân hàng, tài khoản, hạng mục, đối tác & nhân viên) khi còn ở trạng thái Nháp.',
        'Khai báo xong bấm "Khóa (Submit)": dữ liệu không sửa / xóa được nữa. Chỉ Quản trị hệ thống mở khóa được.',
        'Quỹ tiền mặt: Loại quỹ = Tiền mặt, không chọn ngân hàng, ghi tên thủ quỹ. Mã TK nên đặt TM-<mã công ty>.',
        'Nhân viên cần khai báo ở "Đối tác & nhân viên" (Loại = Nhân viên, có công ty) để theo dõi tạm ứng và lương.',
    ]},
    {'title': 'Báo cáo & quyền xem', 'items': [
        'Nhân viên / KTV: nghiệp vụ được giao + Chi tiết theo ngày / tháng của công ty phụ trách.',
        'KTTH, KTT nhóm: kiểm tra / kiểm soát, xem Chi tiết và Tổng hợp của công ty phụ trách.',
        'Giám đốc nhóm: duyệt cấp 2, xem Dashboard, Chi tiết, Tổng hợp của nhóm.',
        'CFO, Chủ tịch: toàn tập đoàn, Dashboard lọc theo nhóm; CFO và KSNB xem Kiểm soát hạch toán.',
        'Ngân quỹ: toàn tập đoàn, xác nhận chi. Quản trị hệ thống: tài khoản, dữ liệu khai báo, mở lại / hủy; không duyệt chi.',
        '"Thu / chi thực" trên báo cáo đã loại các khoản Nội bộ (chuyển tiền giữa các TK, rút / nộp tiền mặt).',
    ]},
]


def guide():
    return {'general': GENERAL, 'modules': [{'title': m.title, 'items': m.help} for m in REGISTRY.values()]}
