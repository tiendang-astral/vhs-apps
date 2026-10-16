// Trang nghiệp vụ (chung cho mọi module): danh sách, form lập chứng từ, chi tiết + duyệt, hộp chờ duyệt.
import { $, $$, api, apiDownload, busy, fileToBase64, confirmBox, date, dateTime, debounce, empty, html, icon, money, monthLabel, overlay, parseMoney, raw, showError, toast, todayStr } from '../core.js';
import { companyCode, fieldOptions, isAdmin, label, moduleMeta, myCompanies, partnerNames, refreshOptions, state } from '../state.js';
import { refreshBadge, setQuery, setTitle } from '../app.js';

const PAGE = 100;
const TABS = [['', 'Tất cả'], ['draft', 'Nháp'], ['submitted', 'Chờ duyệt cấp 1'], ['l1_approved', 'Chờ GĐ trụ cột'], ['dir_approved', 'Chờ Admin duyệt cuối'],
  ['posted', 'Đã ghi sổ'], ['cancelled', 'Đã hủy'], ['reopen', 'Đề nghị mở lại']];
const ACTION = {
  submit: { label: 'Gửi duyệt', icon: 'send', tone: 'primary' },
  approve: { label: 'Duyệt', icon: 'check', tone: 'success' },
  request_reopen: { label: 'Đề nghị mở lại', icon: 'flag', tone: 'warn', input: 'Lý do / nội dung sai cần sửa (bắt buộc)' },
  reopen: { label: 'Mở lại cho sửa', icon: 'undo', tone: 'warn', input: 'Ghi chú (không bắt buộc)' },
  cancel: { label: 'Hủy chứng từ', icon: 'ban', tone: 'danger', input: 'Lý do hủy' },
};
// Trường tính toán phía giao diện (máy chủ luôn tính lại khi lưu)
const COMPUTE = {
  net: (v) => (v.gross || 0) + (v.bonus || 0) - (v.insurance || 0) - (v.pit || 0) - (v.advance_deduction || 0) - (v.other_deduction || 0),
};

export const statusBadge = (d) => html`<span class="badge st-${d.status}">${d.status_label || state.meta.status[d.status]}</span>
  ${d.reopen_requested ? html` <span class="badge st-reopen" title="${d.reopen_note || ''}">Đề nghị mở lại</span>` : ''}`;

export function amountCell(d) {
  const cls = { in: 'in', out: 'out' }[d.direction] || '';
  const sign = d.direction === 'in' ? '+' : d.direction === 'out' ? '−' : '';
  return html`<span class="num ${cls}" style="font-weight:600">${sign}${money(d.amount_view)}</span>`;
}

/** Giá trị hiển thị của 1 trường. */
function show(f, d) {
  const v = d[f.name];
  if (v == null || v === '') return '';
  switch (f.type) {
    case 'money': return money(v);
    case 'date': return date(v);
    case 'month': return monthLabel(v);
    case 'account': return d[f.name + '_code'] || v;
    case 'category': return d[f.name + '_name'] || v;
    case 'company': return companyCode(v);
    case 'select': return label(v);
    case 'number': return String(v).replace('.', ',');
    default: return v;
  }
}
const visible = (f, d) => !f.show || f.show.includes(d.kind);

// ================================================================ danh sách
export async function renderModule(el, [key], query) {
  const m = moduleMeta(key);
  if (!m) throw new Error('Không có quyền truy cập nghiệp vụ này');
  setTitle(m.title, `Nghiệp vụ · ${m.l1_label} → GĐ công ty trụ cột → Admin tập đoàn`);
  const f = { status: query.status || '', company_id: query.company_id || '', from: query.from || '', to: query.to || '', q: query.q || '', mine: query.mine || '', page: +query.page || 0 };
  const cols = m.fields.filter((x) => x.list && x.name !== 'doc_date');
  const amountField = m.fields.find((x) => x.name === 'amount' || x.name === 'net');

  el.innerHTML = String(html`
    <div class="page-head">
      <div><h2>${m.title}</h2><p>${m.help?.[0] || ''}</p></div><div class="sp"></div>
      <a class="btn" href="#/guide">${icon('book')} Hướng dẫn</a>
      ${m.importable && m.can_create ? html`<button class="btn" id="tpl-dl">${icon('download')} Tải biểu mẫu Excel</button>
        <button class="btn" id="imp-xl">${icon('upload')} Nhập từ Excel</button>` : ''}
      ${m.can_create ? html`<button class="btn primary" id="new-doc">${icon('plus')} Lập chứng từ</button>` : ''}
    </div>
    <div class="card">
      <div class="tabs" id="tabs"></div>
      <div class="card-b filters" style="border-bottom:1px solid var(--line-2)">
        <select class="input" id="f-company"><option value="">Tất cả công ty</option>
          ${myCompanies().map((c) => html`<option value="${c.id}">${c.code}</option>`)}</select>
        <input class="input" type="date" id="f-from" title="Từ ngày"><span class="muted">→</span><input class="input" type="date" id="f-to" title="Đến ngày">
        <div class="search">${icon('search')}<input class="input" id="f-q" placeholder="Tìm nội dung, đối tượng, số CT…"></div>
        <label class="check"><input type="checkbox" id="f-mine"> Chỉ chứng từ của tôi</label>
        <div class="sp"></div>
        <button class="btn ghost sm" id="f-reset">${icon('refresh')} Xóa lọc</button>
      </div>
      <div class="tbl-wrap" id="list" style="max-height:calc(100vh - 290px)"></div>
      <div class="pager" id="pager"></div>
    </div>`);
  $('#f-company').value = f.company_id; $('#f-from').value = f.from; $('#f-to').value = f.to; $('#f-q').value = f.q; $('#f-mine').checked = !!f.mine;

  let data = { rows: [], total: 0, counts: {} };
  const selected = new Set();

  async function load() {
    setQuery(f);
    $('#list').innerHTML = '<div class="spinner"></div>';
    try {
      data = await api('/docs/' + key, { query: { status: f.status === 'reopen' ? '' : f.status, reopen: f.status === 'reopen' ? 1 : '', company_id: f.company_id, from: f.from, to: f.to, q: f.q, mine: f.mine ? 1 : '', limit: PAGE, offset: f.page * PAGE } });
    } catch (e) { $('#list').innerHTML = String(html`<div class="note err">${e.message}</div>`); return; }
    selected.clear(); draw();
  }

  function draw() {
    const c = data.counts || {}, all = Object.entries(c).filter(([k]) => k !== 'reopen').reduce((a, [, v]) => a + v, 0);
    $('#tabs').innerHTML = String(html`${TABS.map(([k, t]) => html`<button class="${f.status === k ? 'on' : ''}" data-tab="${k}">${t}
      <span class="cnt">${k === '' ? all : c[k] || 0}</span></button>`)}`);
    const rows = data.rows, canBulk = rows.some((r) => r.actions.includes('approve') || r.actions.includes('submit'));
    if (!rows.length) { $('#list').innerHTML = String(empty('Không có chứng từ phù hợp')); $('#pager').innerHTML = ''; bulkBar(); return; }
    const total = rows.reduce((a, r) => a + (r.direction === 'out' ? -1 : r.direction === 'in' ? 1 : 0) * (r.amount_view || 0), 0);
    $('#list').innerHTML = String(html`<table class="tbl"><thead><tr>
        ${canBulk ? html`<th class="w-check"><input type="checkbox" id="chk-all"></th>` : ''}
        <th>Số CT</th><th>Ngày</th><th>Công ty</th>${cols.map((x) => html`<th class="${x.type === 'money' ? 'num' : ''}">${x.label}</th>`)}
        <th>Trạng thái</th><th>Người lập</th></tr></thead>
      <tbody>${rows.map((r) => html`<tr class="click" data-id="${r.id}">
        ${canBulk ? html`<td><input type="checkbox" class="chk" data-id="${r.id}" ${r.actions.includes('approve') || r.actions.includes('submit') ? '' : 'disabled'}></td>` : ''}
        <td class="muted">#${r.id}</td><td>${date(r.doc_date)}</td><td><b>${r.company_code || ''}</b></td>
        ${cols.map((x) => (x === amountField ? html`<td>${amountCell(r)}</td>` : x.type === 'money' ? html`<td class="num">${money(r[x.name])}</td>` : html`<td class="clip" title="${show(x, r)}">${show(x, r)}</td>`))}
        <td>${statusBadge(r)}</td><td class="small">${r.created_by_name || ''}</td></tr>`)}</tbody>
      <tfoot><tr>${canBulk ? html`<td></td>` : ''}<td colspan="${3 + cols.length}">Cộng trang này (thu − chi)</td><td colspan="2" class="num">${money(total)}</td></tr></tfoot></table>`);
    const pages = Math.ceil(data.total / PAGE);
    $('#pager').innerHTML = String(html`<span>${data.total.toLocaleString('vi-VN')} chứng từ</span><div class="sp"></div>
      ${pages > 1 ? html`<button class="btn sm" data-pg="-1" ${f.page ? '' : 'disabled'}>‹ Trước</button><span>Trang ${f.page + 1}/${pages}</span>
      <button class="btn sm" data-pg="1" ${f.page + 1 < pages ? '' : 'disabled'}>Sau ›</button>` : ''}`);
    bulkBar();
  }

  function bulkBar() {
    $('.bulk')?.remove();
    if (!selected.size) return;
    const rows = data.rows.filter((r) => selected.has(r.id));
    const can = (a) => rows.filter((r) => r.actions.includes(a)).map((r) => r.id);
    const bar = document.createElement('div'); bar.className = 'bulk';
    bar.innerHTML = String(html`<span>Đã chọn <b>${selected.size}</b></span>
      ${can('submit').length ? html`<button class="btn primary" data-bulk="submit">${icon('send')} Gửi duyệt (${can('submit').length})</button>` : ''}
      ${can('approve').length ? html`<button class="btn success" data-bulk="approve">${icon('check')} Duyệt (${can('approve').length})</button>` : ''}
      <button class="btn ghost" style="color:#fff" data-bulk="clear">${icon('x')}</button>`);
    document.body.append(bar);
    bar.onclick = async (e) => {
      const b = e.target.closest('[data-bulk]'); if (!b) return;
      if (b.dataset.bulk === 'clear') { selected.clear(); $$('.chk').forEach((x) => { x.checked = false; }); bar.remove(); return; }
      const ids = can(b.dataset.bulk);
      const ok = await confirmBox({ title: ACTION[b.dataset.bulk].label + ' hàng loạt', message: `Thực hiện cho ${ids.length} chứng từ đã chọn?`, tone: ACTION[b.dataset.bulk].tone });
      if (!ok) return;
      try {
        const r = await api(`/docs/${key}/bulk`, { method: 'POST', body: { ids, action: b.dataset.bulk } });
        toast(`Thành công ${r.done} chứng từ` + (r.failed.length ? `, lỗi ${r.failed.length}: ${r.failed[0].error}` : ''), r.failed.length ? 'err' : 'ok');
        bar.remove(); load(); refreshBadge();
      } catch (err) { showError(err); }
    };
  }

  el.onclick = (e) => {
    const t = e.target;
    if (t.closest('[data-tab]')) { f.status = t.closest('[data-tab]').dataset.tab; f.page = 0; return load(); }
    if (t.closest('[data-pg]')) { f.page += +t.closest('[data-pg]').dataset.pg; return load(); }
    if (t.id === 'chk-all') { $$('.chk:not(:disabled)').forEach((x) => { x.checked = t.checked; x.closest('tr').classList.toggle('sel', t.checked); t.checked ? selected.add(+x.dataset.id) : selected.delete(+x.dataset.id); }); return bulkBar(); }
    if (t.classList.contains('chk')) { t.checked ? selected.add(+t.dataset.id) : selected.delete(+t.dataset.id); t.closest('tr').classList.toggle('sel', t.checked); return bulkBar(); }
    if (t.closest('td:first-child') && t.closest('td').querySelector('.chk')) return;
    const tr = t.closest('tr[data-id]'); if (tr) openDoc(key, +tr.dataset.id, load);
    if (t.closest('#new-doc')) docForm(m, null, load);
    if (t.closest('#tpl-dl')) busy(t.closest('#tpl-dl'), () => apiDownload(`/docs/${key}/template`, `Bieu_mau_${m.title.replace(/\s+/g, '_')}.xlsx`).catch(showError));
    if (t.closest('#imp-xl')) importDialog(m, load);
    if (t.closest('#f-reset')) { Object.assign(f, { company_id: '', from: '', to: '', q: '', mine: '', page: 0 }); ['#f-company', '#f-from', '#f-to', '#f-q'].forEach((s) => { $(s).value = ''; }); $('#f-mine').checked = false; load(); }
  };
  const onF = () => { Object.assign(f, { company_id: $('#f-company').value, from: $('#f-from').value, to: $('#f-to').value, q: $('#f-q').value.trim(), mine: $('#f-mine').checked ? 1 : '', page: 0 }); load(); };
  ['#f-company', '#f-from', '#f-to', '#f-mine'].forEach((s) => { $(s).onchange = onF; });
  $('#f-q').oninput = debounce(onF, 350);
  window.addEventListener('hashchange', () => $('.bulk')?.remove(), { once: true });
  if (query.open) openDoc(key, +query.open, load);
  if (query.new && m.can_create) docForm(m, null, load);
  await load();
}

// ================================================================ nhập từ Excel
export function importDialog(m, onDone) {
  let file = null, b64 = null, res = null;
  const { el, close } = overlay(String(html`
    <div class="modal-h"><div><h3>Nhập ${m.title} từ Excel</h3>
      <div class="small muted">Dùng đúng biểu mẫu tải từ nút "Tải biểu mẫu Excel". Hệ thống kiểm tra từng dòng trước khi nhập.</div></div>
      <div class="sp"></div><button class="btn ghost icon" data-close>${icon('x')}</button></div>
    <div class="modal-b">
      <label class="dropzone" id="imp-drop"><input type="file" id="imp-file" accept=".xlsx,.xlsm" hidden>
        ${icon('upload')}<div><b>Chọn file Excel</b> hoặc kéo thả vào đây</div><div class="small muted" id="imp-name">Định dạng .xlsx, tối đa 5 MB</div></label>
      <div id="imp-result"></div>
    </div>
    <div class="modal-f"><label class="check" style="margin-right:auto"><input type="checkbox" id="imp-submit" checked> Gửi duyệt luôn sau khi nhập</label>
      <button class="btn" data-close>Đóng</button><button class="btn primary" id="imp-go" disabled>${icon('check')} Nhập</button></div>`), { size: 'lg' });
  const drop = $('#imp-drop', el), out = $('#imp-result', el), go = $('#imp-go', el);
  const fmt = (c, v) => (v == null || v === '' ? '' : c.type === 'money' ? money(v) : c.type === 'date' ? date(v) : v);

  async function check(f) {
    file = f; $('#imp-name', el).textContent = f.name;
    out.innerHTML = '<div class="spinner"></div>'; go.disabled = true;
    try {
      b64 = await fileToBase64(f);
      res = await api(`/docs/${m.key}/import`, { method: 'POST', body: { file: b64, filename: f.name, dry_run: true } });
    } catch (e) { out.innerHTML = String(html`<div class="note err mt">${icon('alert')} ${e.message}</div>`); return; }
    const cols = res.columns.filter((c) => !['note', 'doc_no'].includes(c.name));
    out.innerHTML = String(html`
      <div class="grid g3 mt mb">
        <div class="card kpi"><div class="lbl">Tổng số dòng</div><div class="val">${res.total}</div></div>
        <div class="card kpi"><div class="lbl">Hợp lệ</div><div class="val in">${res.valid}</div><div class="sub">Tổng tiền ${money(res.amount)} ₫</div></div>
        <div class="card kpi"><div class="lbl">Dòng lỗi</div><div class="val ${res.errors ? 'out' : ''}">${res.errors}</div><div class="sub">${res.errors ? 'Sửa file rồi tải lên lại' : 'Sẵn sàng nhập'}</div></div>
      </div>
      ${res.errors ? html`<div class="note err">${icon('alert')}<div>Có <b>${res.errors}</b> dòng lỗi. Hệ thống chỉ nhập khi tất cả các dòng hợp lệ (tránh nhập thiếu bảng lương).</div></div>` : ''}
      <div class="card tbl-wrap" style="max-height:46vh"><table class="tbl"><thead><tr><th>Dòng</th><th>Kết quả kiểm tra</th>${cols.map((c) => html`<th class="${c.type === 'money' ? 'num' : ''}">${c.label}</th>`)}<th class="num">${m.key === 'payroll' ? 'Thực lĩnh' : 'Số tiền'}</th></tr></thead>
      <tbody>${res.rows.map((r) => html`<tr class="${Object.keys(r.errors).length ? 'row-err' : ''}"><td class="muted">${r.row}</td>
        <td style="min-width:200px;max-width:320px">${Object.keys(r.errors).length ? html`<div class="small out">${Object.entries(r.errors).map(([k, v]) => html`<div><b>${k}:</b> ${v}</div>`)}</div>` : html`<span class="badge st-posted">Hợp lệ</span>`}</td>
        ${cols.map((c) => html`<td class="${c.type === 'money' ? 'num' : 'clip'}" style="white-space:nowrap">${fmt(c, r.view[c.name])}</td>`)}<td class="num"><b>${money(r.amount)}</b></td></tr>`)}</tbody></table></div>`);
    go.disabled = !!res.errors;
    go.innerHTML = String(html`${icon('check')} Nhập ${res.valid} chứng từ`);
  }
  $('#imp-file', el).onchange = (e) => e.target.files[0] && check(e.target.files[0]);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) check(e.dataTransfer.files[0]); });
  go.onclick = () => busy(go, async () => {
    const submit = $('#imp-submit', el).checked;
    try {
      const r = await api(`/docs/${m.key}/import`, { method: 'POST', body: { file: b64, filename: file.name, dry_run: false, submit } });
      toast(`Đã nhập ${r.created} chứng từ${submit ? ' và gửi duyệt' : ' (Nháp)'}`); close(); onDone?.(); refreshBadge();
    } catch (e) { showError(e); }
  });
}

// ================================================================ form lập / sửa
function inputFor(f, v) {
  const name = f.name, val = v ?? '';
  if (f.computed) return html`<input class="input money" name="${name}" readonly value="${money(val)}">`;
  switch (f.type) {
    case 'date': return html`<input class="input" type="date" name="${name}" value="${val}">`;
    case 'month': return html`<input class="input" type="month" name="${name}" value="${val}">`;
    case 'money': return html`<input class="input money" name="${name}" inputmode="numeric" autocomplete="off" value="${money(val)}" placeholder="0">`;
    case 'number': return html`<input class="input" type="number" step="any" name="${name}" value="${val}">`;
    case 'textarea': return html`<textarea class="input" name="${name}">${val}</textarea>`;
    case 'partner': return html`<input class="input" name="${name}" list="dl-${name}" value="${val}" autocomplete="off">
      <datalist id="dl-${name}">${partnerNames(f).map((p) => html`<option value="${p}">`)}</datalist>`;
    case 'select': case 'account': case 'company': case 'category': case 'ref': {
      const opts = fieldOptions(f), groups = [...new Set(opts.map((o) => o.group || ''))];
      const o = (x) => html`<option value="${x.value}" ${String(x.value) === String(val) ? 'selected' : ''}>${x.label}</option>`;
      return html`<select class="input" name="${name}"><option value="">— Chọn —</option>
        ${groups.length > 1 || groups[0] ? groups.map((g) => html`<optgroup label="${g}">${opts.filter((x) => (x.group || '') === g).map(o)}</optgroup>`) : opts.map(o)}</select>`;
    }
    default: return html`<input class="input" name="${name}" value="${val}" autocomplete="off">`;
  }
}

function readForm(form, fields) {
  const out = {};
  for (const f of fields) {
    const el = form.elements[f.name]; if (!el || f.computed) continue;
    const v = el.value.trim();
    if (f.type === 'money') out[f.name] = parseMoney(v);
    else if (f.type === 'number') out[f.name] = v === '' ? null : parseFloat(v);
    else if (['account', 'company', 'category', 'ref'].includes(f.type)) out[f.name] = v ? +v : null;
    else out[f.name] = v || null;
  }
  return out;
}

export function docForm(m, doc, onSaved) {
  const editing = !!doc, d = doc ? { ...doc } : {};
  if (!editing) {
    for (const f of m.fields) {
      if (f.type === 'date' && f.name === 'doc_date') d[f.name] = todayStr();
      if (f.type === 'month') d[f.name] = todayStr().slice(0, 7);
      if (f.required && ['company', 'account'].includes(f.type)) { const o = fieldOptions(f); if (o.length === 1) d[f.name] = o[0].value; }
    }
    if (m.fields.some((f) => f.name === 'kind')) d.kind = m.fields.find((f) => f.name === 'kind').options[0];
  }
  const { el, close } = overlay(String(html`
    <div class="modal-h"><div><h3>${editing ? `Sửa chứng từ #${doc.id}` : 'Lập chứng từ'} · ${m.title}</h3>
      <div class="small muted">Lưu nháp để sửa tiếp, hoặc Lưu & gửi duyệt cho ${m.l1_label}.</div></div>
      <div class="sp"></div><button class="btn ghost icon" data-close>${icon('x')}</button></div>
    <form class="modal-b" id="doc-form" autocomplete="off"><div class="form">
      ${m.fields.map((f) => (f.computed ? html`<div class="calc" data-f="${f.name}"><span>${f.label}</span><b data-calc="${f.name}">0</b></div>`
        : html`<div class="fld ${f.width === 2 || f.type === 'textarea' ? 'w2' : ''}" data-f="${f.name}">
          <label>${f.label}${f.required ? raw('<span class="req">*</span>') : ''}</label>${inputFor(f, d[f.name])}
          ${f.help ? html`<div class="help">${f.help}</div>` : ''}<div class="err"></div></div>`))}
    </div></form>
    <div class="modal-f"><div class="sp small muted" id="form-msg" style="align-self:center"></div>
      <button class="btn" data-close>Đóng</button>
      <button class="btn" id="save-draft">${icon('file')} Lưu nháp</button>
      <button class="btn primary" id="save-submit">${icon('send')} Lưu & gửi duyệt</button></div>`));
  const form = $('#doc-form', el);

  const sync = () => {
    const kind = form.elements.kind?.value;
    for (const f of m.fields) {
      const box = form.querySelector(`[data-f="${f.name}"]`);
      if (box) box.classList.toggle('hidden', !!(f.show && !f.show.includes(kind)));
    }
    const vals = readForm(form, m.fields);
    for (const f of m.fields.filter((x) => x.computed && COMPUTE[x.name])) form.querySelector(`[data-calc="${f.name}"]`).textContent = money(COMPUTE[f.name](vals)) + ' ₫';
  };
  form.addEventListener('input', (e) => {
    if (e.target.classList.contains('money') && !e.target.readOnly) {
      const el2 = e.target, n = parseMoney(el2.value), fromEnd = el2.value.length - el2.selectionStart;
      el2.value = n == null ? '' : money(n);
      const pos = Math.max(0, el2.value.length - fromEnd); el2.setSelectionRange(pos, pos);
    }
    e.target.closest('.fld')?.classList.remove('has-err');
    sync();
  });
  form.addEventListener('change', sync);
  sync();

  const save = (submit) => async (e) => {
    $$('.fld', form).forEach((x) => { x.classList.remove('has-err'); $('.err', x).textContent = ''; });
    const body = readForm(form, m.fields.filter((f) => !f.show || f.show.includes(form.elements.kind?.value)));
    body._submit = submit;
    await busy(e.currentTarget, async () => {
      try {
        if (editing) await api(`/docs/${m.key}/${doc.id}`, { method: 'PUT', body });
        else await api(`/docs/${m.key}`, { method: 'POST', body });
        toast(submit ? 'Đã lưu và gửi duyệt' : 'Đã lưu nháp');
        close(); onSaved?.(); refreshBadge();
        if (body.counterparty || body.partner || body.employee || body.person) refreshOptions();
      } catch (err) {
        for (const [k, msg] of Object.entries(err.errors || {})) {
          const box = form.querySelector(`[data-f="${k}"]`);
          if (box) { box.classList.add('has-err'); $('.err', box) && ($('.err', box).textContent = msg); }
        }
        $('#form-msg', el).textContent = '';
        showError(err);
      }
    });
  };
  $('#save-draft', el).onclick = save(false);
  $('#save-submit', el).onclick = save(true);
}

/** Nhãn nút duyệt theo bước hiện tại. */
export function approveLabel(d) {
  if (d.status === 'submitted') return 'Duyệt cấp 1';
  if (d.status === 'l1_approved' && d.needs_director) return 'Duyệt cấp 2 (GĐ trụ cột)';
  return 'Duyệt cuối & ghi sổ';
}

// ================================================================ chi tiết chứng từ
export async function openDoc(key, id, onChange) {
  const m = moduleMeta(key);
  const { el, close } = overlay('<div class="spinner"></div>', { kind: 'drawer' });
  let d;
  try { d = await api(`/docs/${key}/${id}`); } catch (e) { close(); return showError(e); }
  const withDir = d.needs_director || !!d.dir_by;
  const steps = [['Lập chứng từ', d.created_by_name, d.created_at], ['Gửi duyệt', '', d.submitted_at],
    [`Duyệt cấp 1 · ${m.l1_label}`, d.l1_by_name, d.l1_at]];
  if (withDir) steps.push(['Duyệt cấp 2 · GĐ công ty trụ cột', d.dir_by_name, d.dir_at]);
  steps.push(['Admin tập đoàn duyệt cuối & ghi sổ', d.l2_by_name, d.l2_at]);
  const done = d.status === 'posted' ? steps.length : ({ draft: 1, submitted: 2, l1_approved: 3, dir_approved: 4 }[d.status] || 0);
  const dirLabel = { in: 'Tiền vào', out: 'Tiền ra', move: 'Chuyển giữa 2 tài khoản', none: 'Không phát sinh tiền' }[d.direction];

  el.innerHTML = String(html`
    <div class="modal-h"><div><div class="small muted">${m.title} · #${d.id}</div><h3 style="margin-top:2px">${d.summary || m.title}</h3></div>
      <div class="sp"></div><button class="btn ghost icon" data-close>${icon('x')}</button></div>
    <div class="modal-b">
      <div class="row mb">${statusBadge(d)}<span class="muted small">Công ty <b>${d.company_code || companyCode(d.company_id)}</b> · Ngày ${date(d.doc_date)}</span></div>
      ${d.reopen_requested ? html`<div class="note">${icon('flag')}<div><b>Đề nghị mở lại:</b> ${d.reopen_note || ''}<br><span class="small">${isAdmin() ? 'Bấm "Mở lại cho sửa" để trả chứng từ về Nháp cho người lập.' : 'Đang chờ Admin tập đoàn xem xét.'}</span></div></div>` : ''}
      ${d.status === 'cancelled' ? html`<div class="note err">${icon('ban')} Chứng từ đã bị hủy, không ghi sổ.</div>` : ''}
      <div class="amount-hero"><div><div class="small muted">${dirLabel}</div><b class="${{ in: 'in', out: 'out' }[d.direction] || ''}">${money(d.amount_view)} ₫</b></div>
        ${d.status === 'posted' ? html`<span class="badge st-posted">Đã vào sổ</span>` : html`<span class="badge st-draft">Chưa vào sổ</span>`}</div>
      ${d.status !== 'cancelled' ? html`<div class="steps">${steps.map((s, i) => html`<div class="step ${i < done ? 'done' : i === done ? 'cur' : ''}">
        <div class="dot">${i < done ? icon('check') : i + 1}</div>${s[0]}
        ${i < done && s[2] ? html`<div class="small muted">${s[1] ? html`${s[1]}<br>` : ''}${dateTime(s[2])}</div>` : ''}</div>`)}</div>` : ''}
      <div class="sec-t">Thông tin chứng từ</div>
      <dl class="dl">${m.fields.filter((f) => visible(f, d) && show(f, d) !== '').map((f) => html`<dt>${f.label}</dt><dd>${show(f, d)}</dd>`)}</dl>
      ${d.ledger?.length ? html`<div class="sec-t">Bút toán đã ghi sổ</div><div class="card"><table class="tbl"><thead><tr><th>Ngày</th><th>Tài khoản</th><th>Diễn giải</th><th class="num">Thu</th><th class="num">Chi</th></tr></thead>
        <tbody>${d.ledger.map((l) => html`<tr><td>${date(l.txn_date)}</td><td><b>${l.account_code}</b></td><td class="small">${l.description}</td><td class="num in">${money(l.amount_in || '')}</td><td class="num out">${money(l.amount_out || '')}</td></tr>`)}</tbody></table></div>` : ''}
      <div class="sec-t">Lịch sử xử lý</div>
      <ul class="timeline">${(d.events || []).slice().reverse().map((e) => html`<li><b>${e.action}</b> · ${e.user_name || ''}
        <div class="when">${dateTime(e.at)}</div>${e.note ? html`<div class="small" style="color:var(--text-2)">“${e.note}”</div>` : ''}</li>`)}</ul>
    </div>
    <div class="modal-f">
      ${d.actions.includes('delete') ? html`<button class="btn danger" data-act="delete">${icon('trash')} Xóa</button>` : ''}
      <div class="sp"></div>
      ${d.actions.filter((a) => ACTION[a] || a === 'edit').map((a) => (a === 'edit' ? html`<button class="btn" data-act="edit">${icon('edit')} Sửa</button>`
        : html`<button class="btn ${ACTION[a].tone}" data-act="${a}">${icon(ACTION[a].icon)} ${a === 'approve' ? approveLabel(d) : ACTION[a].label}</button>`))}
      ${!d.actions.length ? html`<span class="small muted">Không có thao tác nào cho bạn ở trạng thái này.</span>` : ''}
    </div>`);

  el.onclick = async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'edit') { close(); return docForm(m, d, onChange); }
    if (a === 'delete') {
      if (!(await confirmBox({ title: 'Xóa chứng từ nháp?', message: 'Chứng từ sẽ bị xóa vĩnh viễn.', ok: 'Xóa', tone: 'danger' }))) return;
      try { await api(`/docs/${key}/${id}`, { method: 'DELETE' }); toast('Đã xóa'); close(); onChange?.(); } catch (err) { showError(err); }
      return;
    }
    const cfg = ACTION[a];
    const final = d.status === 'dir_approved' || (d.status === 'l1_approved' && !d.needs_director);
    const msg = { submit: 'Sau khi gửi, chứng từ không sửa được nữa (chỉ Admin tập đoàn mở lại được).',
      approve: final ? 'Chứng từ sẽ được ghi sổ và cập nhật vào báo cáo.' : d.status === 'submitted' && d.needs_director ? 'Chuyển chứng từ lên Giám đốc công ty trụ cột duyệt cấp 2.'
        : d.status === 'submitted' ? 'Chuyển chứng từ lên Admin tập đoàn duyệt cuối.' : 'Chuyển chứng từ lên Admin tập đoàn duyệt cuối.',
      request_reopen: 'Gửi đề nghị để Admin tập đoàn mở lại chứng từ cho người lập sửa.', reopen: 'Chứng từ trở về Nháp' + (d.status === 'posted' ? ', bút toán đã ghi sổ sẽ bị hủy.' : '.'), cancel: 'Chứng từ bị hủy' + (d.status === 'posted' ? ' và bút toán bị xóa khỏi sổ.' : '.') }[a];
    const r = await confirmBox({ title: (a === 'approve' ? approveLabel(d) : cfg.label) + ` #${id}`, message: msg, ok: 'Xác nhận', tone: cfg.tone === 'warn' ? 'primary' : cfg.tone, input: cfg.input });
    if (!r) return;
    try {
      await api(`/docs/${key}/${id}/${a}`, { method: 'POST', body: { note: r.note } });
      toast('Đã thực hiện: ' + cfg.label); close(); onChange?.(); refreshBadge();
    } catch (err) { showError(err); }
  };
}

// ================================================================ hộp chờ duyệt
export async function renderInbox(el) {
  setTitle('Chứng từ chờ duyệt', 'Những chứng từ đang chờ bạn xử lý');
  const load = async () => {
    const rows = await api('/inbox');
    const by = {};
    rows.forEach((r) => (by[r.module] ||= { title: r.module_title, rows: [] }).rows.push(r));
    el.innerHTML = String(html`
      <div class="page-head"><div><h2>Chứng từ chờ duyệt</h2><p>${rows.length ? `${rows.length} chứng từ đang chờ bạn xử lý` : 'Không còn chứng từ nào chờ bạn duyệt'}</p></div></div>
      ${!rows.length ? html`<div class="card">${empty('Tuyệt vời! Bạn đã xử lý hết chứng từ.', 'check')}</div>` : ''}
      ${Object.entries(by).map(([key, g]) => html`<div class="card mb" data-module="${key}">
        <div class="card-h"><h3>${g.title}</h3><span class="badge st-submitted plain">${g.rows.length}</span><div class="sp"></div>
          ${g.rows.some((r) => r.actions.includes('approve')) ? html`<button class="btn success sm" data-approve-all="${key}">${icon('check')} Duyệt tất cả (${g.rows.filter((r) => r.actions.includes('approve')).length})</button>` : ''}</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Số CT</th><th>Ngày</th><th>Công ty</th><th>Nội dung</th><th class="num">Số tiền</th><th>Trạng thái</th><th>Người lập</th></tr></thead>
        <tbody>${g.rows.map((r) => html`<tr class="click" data-id="${r.id}"><td class="muted">#${r.id}</td><td>${date(r.doc_date)}</td><td><b>${r.company_code}</b></td>
          <td class="clip">${r.summary}</td><td>${amountCell(r)}</td><td>${statusBadge(r)}</td><td class="small">${r.created_by_name}</td></tr>`)}</tbody></table></div></div>`)}`);
  };
  el.onclick = async (e) => {
    const all = e.target.closest('[data-approve-all]');
    if (all) {
      const key = all.dataset.approveAll;
      const ids = [...el.querySelectorAll(`[data-module="${key}"] tr[data-id]`)].map((t) => +t.dataset.id);
      if (!(await confirmBox({ title: 'Duyệt tất cả', message: `Duyệt ${ids.length} chứng từ ${moduleMeta(key).title}?`, tone: 'success' }))) return;
      const r = await api(`/docs/${key}/bulk`, { method: 'POST', body: { ids, action: 'approve' } });
      toast(`Đã duyệt ${r.done} chứng từ` + (r.failed.length ? `, ${r.failed.length} lỗi: ${r.failed[0].error}` : ''), r.failed.length ? 'err' : 'ok');
      load(); refreshBadge(); return;
    }
    const tr = e.target.closest('tr[data-id]');
    if (tr) openDoc(tr.closest('[data-module]').dataset.module, +tr.dataset.id, () => { load(); });
  };
  await load();
}
