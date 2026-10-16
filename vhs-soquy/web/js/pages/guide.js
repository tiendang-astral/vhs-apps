// Hướng dẫn nhập liệu (thay cho sheet "Hướng dẫn" của file Excel).
import { api, html, icon } from '../core.js';
import { state } from '../state.js';
import { setTitle } from '../app.js';

export async function renderGuide(el) {
  setTitle('Hướng dẫn nhập liệu', 'Hệ thống · Quy trình & cách nhập từng nghiệp vụ');
  const g = await api('/guide');
  const u = state.user;
  el.innerHTML = String(html`
    <div class="page-head"><div><h2>Hướng dẫn nhập liệu</h2><p>Xin chào <b>${u.full_name}</b> (${u.role_label}). Dưới đây là quy trình và cách nhập từng nghiệp vụ.</p></div></div>
    <div class="card mb"><div class="card-h"><h3>Quy trình duyệt chứng từ</h3></div><div class="card-b">
      <div class="flow">
        <div class="node">1. Lập chứng từ<small>Kế toán / Nhân sự · Nháp, sửa được</small></div><span class="arr">${icon('send')}</span>
        <div class="node">2. Gửi duyệt<small>Khóa sửa</small></div><span class="arr">→</span>
        <div class="node">3. Duyệt cấp 1<small>Kế toán trưởng · hoặc Kế toán duyệt lương</small></div><span class="arr">→</span>
        <div class="node">4. Duyệt cấp 2<small>Giám đốc công ty trụ cột (Admin 2)</small></div><span class="arr">→</span>
        <div class="node" style="background:var(--in-soft);border-color:#bfe9d6">5. Admin tập đoàn duyệt cuối<small>Tự động ghi sổ & cập nhật báo cáo</small></div>
      </div>
      <div class="note info mt" style="margin-bottom:0">${icon('flag')}<div>Sai sót sau khi gửi: bấm <b>Đề nghị mở lại</b> trong chi tiết chứng từ và ghi lý do. Chỉ <b>Admin tập đoàn</b> mở lại được cho người lập sửa. Nhóm chưa có tài khoản GĐ công ty trụ cột thì bỏ qua bước 4.</div></div>
    </div></div>
    <div class="grid g3 mb">${g.general.map((s) => html`<div class="card guide-card"><div class="card-h"><h3>${s.title}</h3></div><div class="card-b"><ol>${s.items.map((i) => html`<li>${i}</li>`)}</ol></div></div>`)}</div>
    <h3 style="margin:24px 0 12px">Hướng dẫn theo nghiệp vụ</h3>
    <div class="grid g2">${g.modules.map((m) => html`<div class="card guide-card"><div class="card-h"><h3>${m.title}</h3></div><div class="card-b"><ol>${m.items.map((i) => html`<li>${i}</li>`)}</ol></div></div>`)}</div>`);
}
