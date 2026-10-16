// Dữ liệu khai báo: công ty, ngân hàng, tài khoản, hạng mục, đối tác & nhân viên.
// Mọi tài khoản được thêm / sửa / xóa khi còn Nháp; sau khi Khóa (submit) chỉ Admin tập đoàn mở khóa được.
import { $, $$, api, busy, confirmBox, date, debounce, empty, html, icon, money, overlay, parseMoney, raw, showError, toast } from '../core.js';
import { fieldOptions, isAdmin, label, refreshOptions, state } from '../state.js';
import { setQuery, setTitle } from '../app.js';

const ORDER = ['companies', 'company_groups', 'banks', 'accounts', 'categories', 'partners'];

export async function renderMaster(el, _p, query) {
  setTitle('Dữ liệu khai báo', 'Hệ thống · Danh mục dùng chung');
  const metas = ORDER.map((k) => state.meta.master.find((m) => m.key === k)).filter(Boolean);
  let tab = query.tab && metas.some((m) => m.key === query.tab) ? query.tab : metas[0].key;
  let rows = [], q = '';
  const selected = new Set();

  el.innerHTML = String(html`
    <div class="page-head"><div><h2>Dữ liệu khai báo</h2><p>Khai báo xong bấm <b>Khóa (Submit)</b> để chốt. Dữ liệu đã khóa không sửa / xóa được — chỉ Admin tập đoàn mở khóa.</p></div></div>
    <div class="card"><div class="tabs" id="m-tabs"></div>
      <div class="card-b filters" style="border-bottom:1px solid var(--line-2)">
        <div class="search">${icon('search')}<input class="input" id="m-q" placeholder="Tìm kiếm…"></div>
        <div class="sp"></div>
        <button class="btn" id="m-lock" disabled>${icon('lock')} Khóa (Submit)</button>
        ${isAdmin() ? html`<button class="btn warn" id="m-unlock" disabled>${icon('unlock')} Mở khóa</button>` : ''}
        <button class="btn primary" id="m-add">${icon('plus')} Thêm mới</button>
      </div>
      <div class="tbl-wrap" id="m-list" style="max-height:calc(100vh - 270px)"></div></div>`);

  const meta = () => metas.find((m) => m.key === tab);
  const refName = (f, v) => {
    const r = (state.options[f.source] || []).find((x) => x.id === v);
    return r ? (r.code || r.name) : '';
  };
  const cell = (f, r) => {
    const v = r[f.name];
    if (v == null || v === '') return '';
    if (f.type === 'ref') return refName(f, v);
    if (f.type === 'select') return label(v);
    if (f.type === 'money') return money(v);
    if (f.type === 'date') return date(v);
    return v;
  };

  async function load() {
    setQuery({ tab });
    $('#m-tabs').innerHTML = String(html`${metas.map((m) => html`<button class="${m.key === tab ? 'on' : ''}" data-tab="${m.key}">${m.title}</button>`)}`);
    $('#m-list').innerHTML = '<div class="spinner"></div>';
    rows = await api('/master/' + tab);
    selected.clear(); draw();
  }
  function draw() {
    const m = meta(), cols = m.fields.filter((f) => f.list);
    const list = q ? rows.filter((r) => JSON.stringify(Object.values(r)).toLowerCase().includes(q)) : rows;
    $('#m-lock').disabled = true;
    if ($('#m-unlock')) $('#m-unlock').disabled = true;
    if (!list.length) { $('#m-list').innerHTML = String(empty('Chưa có dữ liệu')); return; }
    $('#m-list').innerHTML = String(html`<table class="tbl"><thead><tr><th class="w-check"><input type="checkbox" id="m-all"></th>
      ${cols.map((f) => html`<th class="${f.type === 'money' ? 'num' : ''}">${f.label}</th>`)}<th>Trạng thái khai báo</th><th>Người tạo</th><th></th></tr></thead>
      <tbody>${list.map((r) => html`<tr data-id="${r.id}"><td><input type="checkbox" class="m-chk" data-id="${r.id}"></td>
        ${cols.map((f, i) => html`<td class="${f.type === 'money' ? 'num' : 'clip'}">${i === 0 ? html`<b>${cell(f, r)}</b>` : cell(f, r)}</td>`)}
        <td>${r.locked ? html`<span class="badge st-locked plain">${icon('lock')} Đã khóa</span>` : html`<span class="badge st-open">Nháp – sửa được</span>`}</td>
        <td class="small muted">${r.created_by_name || ''}</td>
        <td class="num">${r.locked ? '' : html`<button class="btn sm ghost" data-edit="${r.id}">${icon('edit')}</button><button class="btn sm ghost" style="color:var(--out)" data-del="${r.id}">${icon('trash')}</button>`}</td></tr>`)}</tbody></table>`);
  }
  const syncBtns = () => {
    const sel = rows.filter((r) => selected.has(r.id));
    $('#m-lock').disabled = !sel.some((r) => !r.locked);
    if ($('#m-unlock')) $('#m-unlock').disabled = !sel.some((r) => r.locked);
  };

  el.onclick = async (e) => {
    const t = e.target;
    const tb = t.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; q = ''; $('#m-q').value = ''; return load(); }
    if (t.id === 'm-all') { $$('.m-chk').forEach((c) => { c.checked = t.checked; t.checked ? selected.add(+c.dataset.id) : selected.delete(+c.dataset.id); }); return syncBtns(); }
    if (t.classList.contains('m-chk')) { t.checked ? selected.add(+t.dataset.id) : selected.delete(+t.dataset.id); return syncBtns(); }
    if (t.closest('#m-add')) return form(null);
    const ed = t.closest('[data-edit]'); if (ed) return form(rows.find((r) => r.id === +ed.dataset.edit));
    const del = t.closest('[data-del]');
    if (del) {
      if (!(await confirmBox({ title: 'Xóa dòng khai báo?', message: 'Không thể xóa nếu dữ liệu đã được dùng trong chứng từ.', ok: 'Xóa', tone: 'danger' }))) return;
      try { await api(`/master/${tab}/${del.dataset.del}`, { method: 'DELETE' }); toast('Đã xóa'); await refreshOptions(); load(); } catch (err) { showError(err); }
      return;
    }
    const lk = t.closest('#m-lock, #m-unlock');
    if (lk) {
      const op = lk.id === 'm-lock' ? 'lock' : 'unlock';
      const ids = rows.filter((r) => selected.has(r.id) && !!r.locked === (op === 'unlock')).map((r) => r.id);
      const ok = await confirmBox({ title: op === 'lock' ? 'Khóa dữ liệu khai báo' : 'Mở khóa dữ liệu', tone: op === 'lock' ? 'primary' : 'warn',
        message: op === 'lock' ? `Khóa ${ids.length} dòng. Sau khi khóa sẽ không sửa / xóa được (chỉ Admin tập đoàn mở khóa).` : `Mở khóa ${ids.length} dòng để cho phép sửa lại.` });
      if (!ok) return;
      try { const r = await api(`/master/${tab}/${op}`, { method: 'POST', body: { ids } }); toast(`Đã ${op === 'lock' ? 'khóa' : 'mở khóa'} ${r.count} dòng`); load(); } catch (err) { showError(err); }
    }
  };
  $('#m-q').oninput = debounce((e) => { q = e.target.value.trim().toLowerCase(); draw(); }, 200);

  function form(row) {
    const m = meta(), v = row || {};
    const input = (f) => {
      const val = v[f.name] ?? '';
      if (f.type === 'select' || f.type === 'ref') {
        return html`<select class="input" name="${f.name}"><option value="">— Chọn —</option>${fieldOptions(f).map((o) => html`<option value="${o.value}" ${String(o.value) === String(val) ? 'selected' : ''}>${o.label}</option>`)}</select>`;
      }
      if (f.type === 'money') return html`<input class="input money" name="${f.name}" value="${money(val)}" inputmode="numeric">`;
      if (f.type === 'date') return html`<input class="input" type="date" name="${f.name}" value="${val}">`;
      return html`<input class="input" name="${f.name}" value="${val}" autocomplete="off">`;
    };
    const { el: dlg, close } = overlay(String(html`
      <div class="modal-h"><h3>${row ? 'Sửa' : 'Thêm'} · ${m.title}</h3><div class="sp"></div><button class="btn ghost icon" data-close>${icon('x')}</button></div>
      <form class="modal-b" id="mf"><div class="form">${m.fields.map((f) => html`<div class="fld ${f.width === 2 ? 'w2' : ''}" data-f="${f.name}">
        <label>${f.label}${f.required ? raw('<span class="req">*</span>') : ''}</label>${input(f)}${f.help ? html`<div class="help">${f.help}</div>` : ''}<div class="err"></div></div>`)}</div></form>
      <div class="modal-f"><button class="btn" data-close>Hủy</button><button class="btn primary" id="mf-save">${icon('check')} Lưu</button></div>`));
    const fm = $('#mf', dlg);
    fm.addEventListener('input', (e) => { if (e.target.classList.contains('money')) { const n = parseMoney(e.target.value); e.target.value = n == null ? '' : money(n); } });
    $('#mf-save', dlg).onclick = (e) => busy(e.currentTarget, async () => {
      const body = {};
      for (const f of m.fields) {
        const x = fm.elements[f.name].value.trim();
        body[f.name] = f.type === 'money' ? parseMoney(x) : f.type === 'ref' ? (x ? +x : null) : x || null;
      }
      $$('.fld', fm).forEach((b) => { b.classList.remove('has-err'); $('.err', b).textContent = ''; });
      try {
        if (row) await api(`/master/${tab}/${row.id}`, { method: 'PUT', body }); else await api('/master/' + tab, { method: 'POST', body });
        toast('Đã lưu'); close(); await refreshOptions(); load();
      } catch (err) {
        Object.entries(err.errors || {}).forEach(([k, msg]) => { const b = fm.querySelector(`[data-f="${k}"]`); if (b) { b.classList.add('has-err'); $('.err', b).textContent = msg; } });
        showError(err);
      }
    });
  }
  await load();
}
