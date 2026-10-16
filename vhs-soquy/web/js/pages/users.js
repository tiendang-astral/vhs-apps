// Quản trị tài khoản (chỉ Admin tập đoàn): thêm / sửa / xóa, giao công ty phụ trách và quyền nghiệp vụ.
import { $, $$, api, busy, confirmBox, date, html, icon, initials, overlay, raw, showError, toast } from '../core.js';
import { state } from '../state.js';
import { setTitle } from '../app.js';

const ROLE_HINT = {
  staff: 'Lập chứng từ các nghiệp vụ được giao. Có quyền "Duyệt lương" thì là Kế toán duyệt lương (duyệt cấp 1 bảng lương).',
  chief_accountant: 'Duyệt cấp 1 các nghiệp vụ Thu Chi, Thanh toán đối tác, Quỹ TM của công ty phụ trách; xem Chi tiết + Tổng hợp.',
  director: 'Admin 2 – Giám đốc công ty trụ cột: duyệt cấp 2 (sau Kế toán trưởng / Kế toán duyệt lương) cho các công ty được giao, xem Dashboard + Chi tiết + Tổng hợp của nhóm. Bấm "Cả nhóm" để giao toàn bộ công ty của nhóm trụ cột.',
  admin: 'Admin tập đoàn – toàn quyền: duyệt cuối, mở lại chứng từ, mở khóa dữ liệu, quản trị tài khoản, Dashboard toàn tập đoàn.',
};

export async function renderUsers(el) {
  setTitle('Tài khoản người dùng', 'Hệ thống · Phân quyền theo vai trò & công ty');
  const roleTone = { staff: 'st-open', chief_accountant: 'st-l1_approved', director: 'st-dir_approved', admin: 'st-posted' };
  const companies = state.options.companies, groups = state.options.company_groups;
  const perms = state.meta.permissions;
  let users = [];
  const load = async () => {
    users = await api('/users');
    el.innerHTML = String(html`
      <div class="page-head"><div><h2>Tài khoản người dùng</h2><p>4 loại tài khoản: Nhân viên, Kế toán trưởng, Giám đốc công ty trụ cột (Admin 2), Admin tập đoàn. Ngoài Admin tập đoàn, mọi tài khoản chỉ thấy dữ liệu của công ty được giao.</p></div>
        <div class="sp"></div><button class="btn primary" id="u-add">${icon('plus')} Thêm tài khoản</button></div>
      <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Quyền nghiệp vụ</th><th>Công ty phụ trách</th><th>Trạng thái</th><th>Ngày tạo</th><th></th></tr></thead>
      <tbody>${users.map((u) => html`<tr>
        <td><div class="row" style="flex-wrap:nowrap"><div class="avatar">${initials(u.full_name)}</div><div><b>${u.full_name}</b><div class="small muted">@${u.username}</div></div></div></td>
        <td><span class="badge ${roleTone[u.role]}">${u.role_label}</span></td>
        <td class="small">${u.role === 'staff' ? u.permissions.map((p) => perms.find((x) => x.key === p)?.label || p).join(', ') || html`<span class="muted">Chỉ xem</span>` : html`<span class="muted">Theo vai trò</span>`}</td>
        <td class="small">${u.role === 'admin' ? html`<span class="muted">Toàn tập đoàn</span>` : u.company_ids.map((id) => companies.find((c) => c.id === id)?.code).filter(Boolean).join(', ')}</td>
        <td>${u.active ? html`<span class="badge st-posted">Hoạt động</span>` : html`<span class="badge st-cancelled">Đã khóa</span>`}</td>
        <td class="small">${date(u.created_at)}</td>
        <td class="num"><button class="btn sm ghost" data-edit="${u.id}">${icon('edit')} Sửa</button>
          ${u.id !== state.user.id ? html`<button class="btn sm ghost" style="color:var(--out)" data-del="${u.id}">${icon('trash')}</button>` : ''}</td></tr>`)}</tbody></table></div></div>`);
  };
  el.onclick = async (e) => {
    if (e.target.closest('#u-add')) return form(null);
    const ed = e.target.closest('[data-edit]'); if (ed) return form(users.find((u) => u.id === +ed.dataset.edit));
    const del = e.target.closest('[data-del]');
    if (del) {
      const u = users.find((x) => x.id === +del.dataset.del);
      if (!(await confirmBox({ title: `Xóa tài khoản ${u.username}?`, message: 'Nếu tài khoản đã có chứng từ, hệ thống sẽ khóa thay vì xóa để giữ lịch sử.', ok: 'Xóa', tone: 'danger' }))) return;
      try { const r = await api('/users/' + u.id, { method: 'DELETE' }); toast(r.result === 'deleted' ? 'Đã xóa tài khoản' : 'Tài khoản đã có chứng từ → đã khóa'); load(); } catch (err) { showError(err); }
    }
  };

  function form(u) {
    const v = u || { role: 'staff', permissions: [], company_ids: [], active: 1 };
    const { el: dlg, close } = overlay(String(html`
      <div class="modal-h"><h3>${u ? `Sửa tài khoản @${u.username}` : 'Thêm tài khoản'}</h3><div class="sp"></div><button class="btn ghost icon" data-close>${icon('x')}</button></div>
      <form class="modal-b" id="uf" autocomplete="off"><div class="form">
        <div class="fld" data-f="username"><label>Tên đăng nhập<span class="req">*</span></label><input class="input" name="username" value="${v.username || ''}"><div class="err"></div></div>
        <div class="fld" data-f="full_name"><label>Họ tên<span class="req">*</span></label><input class="input" name="full_name" value="${v.full_name || ''}"><div class="err"></div></div>
        <div class="fld" data-f="role"><label>Vai trò<span class="req">*</span></label><select class="input" name="role">
          ${Object.entries(state.meta.roles).map(([k, t]) => html`<option value="${k}" ${v.role === k ? 'selected' : ''}>${t}</option>`)}</select><div class="help" id="role-hint"></div></div>
        <div class="fld" data-f="password"><label>${u ? 'Mật khẩu mới (bỏ trống nếu không đổi)' : raw('Mật khẩu<span class="req">*</span>')}</label><input class="input" name="password" type="password" autocomplete="new-password"><div class="err"></div></div>
        <div class="fld w2" data-f="permissions" id="perm-box"><label>Quyền nghiệp vụ (Nhân viên)</label><div class="chips">
          ${perms.map((p) => html`<label class="chip-check"><input type="checkbox" name="perm" value="${p.key}" ${v.permissions.includes(p.key) ? 'checked' : ''}>${p.label}</label>`)}</div>
          <div class="help">Nhân sự: chọn "Lập bảng lương". Kế toán duyệt lương: chọn "Duyệt lương". Kế toán: chọn các nghiệp vụ lập chứng từ.</div></div>
        <div class="fld w2" data-f="company_ids" id="co-box"><label>Công ty phụ trách<span class="req">*</span></label>
          ${groups.map((g) => html`<div class="row" style="margin:4px 0"><span class="small muted" style="width:120px">${g.name}</span>
            <button type="button" class="btn sm ghost" data-grp="${g.id}" title="Chọn tất cả công ty của nhóm">Cả nhóm</button><div class="chips">
            ${companies.filter((c) => c.group_id === g.id).map((c) => html`<label class="chip-check" title="${c.name}"><input type="checkbox" name="co" data-g="${g.id}" value="${c.id}" ${v.company_ids.includes(c.id) ? 'checked' : ''}>${c.code}</label>`)}</div></div>`)}
          <div class="row" style="margin-top:6px"><button type="button" class="btn sm ghost" id="co-all">Chọn tất cả</button><button type="button" class="btn sm ghost" id="co-none">Bỏ chọn</button></div><div class="err"></div></div>
        <div class="fld w2"><label class="check"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> Tài khoản đang hoạt động</label></div>
      </div></form>
      <div class="modal-f"><button class="btn" data-close>Hủy</button><button class="btn primary" id="uf-save">${icon('check')} Lưu</button></div>`));
    const f = $('#uf', dlg);
    const sync = () => {
      const r = f.role.value;
      $('#role-hint', dlg).textContent = ROLE_HINT[r];
      $('#perm-box', dlg).classList.toggle('hidden', r !== 'staff');
      $('#co-box', dlg).classList.toggle('hidden', r === 'admin');
    };
    f.role.onchange = sync; sync();
    f.addEventListener('click', (ev) => {
      const gb = ev.target.closest('[data-grp]'); if (!gb) return;
      const boxes = $$(`[name=co][data-g="${gb.dataset.grp}"]`, f), on = !boxes.every((c) => c.checked);
      boxes.forEach((c) => { c.checked = on; });
    });
    $('#co-all', dlg).onclick = () => $$('[name=co]', f).forEach((c) => { c.checked = true; });
    $('#co-none', dlg).onclick = () => $$('[name=co]', f).forEach((c) => { c.checked = false; });
    $('#uf-save', dlg).onclick = (e) => busy(e.currentTarget, async () => {
      const body = { username: f.username.value, full_name: f.full_name.value, role: f.role.value, password: f.password.value, active: f.active.checked,
        permissions: $$('[name=perm]:checked', f).map((c) => c.value), company_ids: $$('[name=co]:checked', f).map((c) => +c.value) };
      $$('.fld', f).forEach((b) => { b.classList.remove('has-err'); const x = $('.err', b); if (x) x.textContent = ''; });
      try {
        if (u) await api('/users/' + u.id, { method: 'PUT', body }); else await api('/users', { method: 'POST', body });
        toast('Đã lưu tài khoản'); close(); load();
      } catch (err) {
        Object.entries(err.errors || {}).forEach(([k, msg]) => { const b = f.querySelector(`[data-f="${k}"]`); if (b) { b.classList.add('has-err'); const x = $('.err', b); if (x) x.textContent = msg; } });
        showError(err);
      }
    });
  }
  await load();
}
