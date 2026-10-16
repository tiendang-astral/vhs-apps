// Báo cáo: Chi tiết theo ngày / tháng (sổ quỹ), Tổng hợp theo ngày / tháng, Kiểm soát hạch toán.
import { $, api, date, downloadCSV, empty, html, icon, money, monthLabel, todayStr } from '../core.js';
import { combo } from '../charts.js';
import { label, moduleMeta, myCompanies, state } from '../state.js';
import { setQuery, setTitle } from '../app.js';
import { openDoc } from './docs.js';

const card = (lbl, val, cls = '', sub = '') => html`<div class="card kpi"><div class="lbl">${lbl}</div><div class="val ${cls}">${val}</div><div class="sub">${sub}</div></div>`;
const SHORT = { cashbook: 'Thu chi', partner_payment: 'Đối tác', payroll: 'Lương', cash_fund: 'Quỹ TM' };
const monthEnd = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); };
const companyOpts = (sel) => html`<option value="">Tất cả công ty phụ trách</option>${myCompanies().map((c) => html`<option value="${c.id}" ${String(c.id) === String(sel) ? 'selected' : ''}>${c.code} – ${c.name}</option>`)}`;

// ================================================================ chi tiết (sổ quỹ)
export const renderLedger = (mode) => async (el, _p, query) => {
  const day = mode === 'day';
  setTitle(day ? 'Chi tiết theo ngày' : 'Chi tiết theo tháng', 'Báo cáo · Sổ quỹ chi tiết từ chứng từ đã ghi sổ');
  const f = { date: query.date || todayStr(), month: query.month || todayStr().slice(0, 7), company_id: query.company_id || '', account_id: query.account_id || '', category_id: query.category_id || '' };
  el.innerHTML = String(html`
    <div class="page-head"><div><h2>${day ? 'Sổ quỹ chi tiết theo ngày' : 'Sổ quỹ chi tiết theo tháng'}</h2><p>Chỉ gồm chứng từ đã được Admin tập đoàn duyệt cuối. Số dư lũy kế tính theo bộ lọc tài khoản / công ty.</p></div></div>
    <div class="card mb"><div class="card-b filters">
      ${day ? html`<input class="input" type="date" id="l-date" value="${f.date}">` : html`<input class="input" type="month" id="l-month" value="${f.month}">`}
      <select class="input" id="l-company">${companyOpts(f.company_id)}</select>
      <select class="input" id="l-account"></select>
      <select class="input" id="l-category"><option value="">Tất cả hạng mục</option>${state.options.categories.map((c) => html`<option value="${c.id}" ${String(c.id) === f.category_id ? 'selected' : ''}>${c.name}</option>`)}</select>
      <div class="sp"></div><button class="btn" id="l-csv">${icon('download')} Xuất CSV</button><button class="btn icon" id="l-print">${icon('printer')}</button>
    </div></div>
    <div class="grid g4 mb" id="l-kpi"></div>
    <div class="card"><div class="tbl-wrap" id="l-table" style="max-height:calc(100vh - 330px)"></div></div>`);
  const accOpts = () => {
    const mine = new Set(state.user.company_ids);
    const list = state.options.accounts.filter((a) => mine.has(a.company_id) && (!f.company_id || String(a.company_id) === String(f.company_id)));
    if (f.account_id && !list.some((a) => String(a.id) === String(f.account_id))) f.account_id = '';
    $('#l-account').innerHTML = String(html`<option value="">Tất cả tài khoản</option>${list.map((a) => html`<option value="${a.id}" ${String(a.id) === String(f.account_id) ? 'selected' : ''}>${a.code} (${a.company_code})</option>`)}`);
  };
  accOpts();
  let data;
  const load = async () => {
    setQuery(f);
    const from = day ? f.date : f.month + '-01', to = day ? f.date : monthEnd(f.month);
    $('#l-table').innerHTML = '<div class="spinner"></div>';
    data = await api('/reports/ledger', { query: { from, to, company_id: f.company_id, account_id: f.account_id, category_id: f.category_id } });
    const hasBal = data.opening != null;
    $('#l-kpi').innerHTML = String(html`${card('Số dư đầu kỳ', hasBal ? money(data.opening) : '—')}${card('Tổng thu', money(data.inflow), 'in', `${data.rows.filter((r) => r.amount_in).length} bút toán`)}
      ${card('Tổng chi', money(data.outflow), 'out', `${data.rows.filter((r) => r.amount_out).length} bút toán`)}${card('Số dư cuối kỳ', hasBal ? money(data.closing) : '—', '', hasBal ? '' : 'Lọc theo hạng mục: không tính số dư')}`);
    if (!data.rows.length) { $('#l-table').innerHTML = String(empty('Không có phát sinh trong kỳ')); return; }
    let lastDay = '', body = [];
    const days = {};
    data.rows.forEach((r) => { const x = days[r.txn_date] ||= { i: 0, o: 0 }; x.i += r.amount_in; x.o += r.amount_out; });
    for (const r of data.rows) {
      if (!day && r.txn_date !== lastDay) {
        lastDay = r.txn_date;
        body.push(html`<tr class="grp"><td colspan="7">${date(r.txn_date)}</td><td class="num in">${days[r.txn_date].i ? money(days[r.txn_date].i) : ''}</td><td class="num out">${days[r.txn_date].o ? money(days[r.txn_date].o) : ''}</td>${hasBal ? html`<td></td>` : ''}</tr>`);
      }
      body.push(html`<tr class="click" data-m="${r.module}" data-id="${r.doc_id}"><td>${date(r.txn_date)}</td><td><b>${r.company_code}</b></td><td>${r.account_code}</td>
        <td class="clip" style="max-width:130px">${r.counterparty || ''}</td><td class="clip" style="max-width:210px" title="${r.description}">${r.description}</td><td class="small clip" style="max-width:150px" title="${r.category || ''}">${r.category || ''}</td>
        <td class="small muted" style="white-space:nowrap" title="${r.source}">${SHORT[r.module] || r.source} #${r.doc_id}</td><td class="num in">${r.amount_in ? money(r.amount_in) : ''}</td><td class="num out">${r.amount_out ? money(r.amount_out) : ''}</td>
        ${hasBal ? html`<td class="num"><b>${money(r.balance)}</b></td>` : ''}</tr>`);
    }
    $('#l-table').innerHTML = String(html`<table class="tbl"><thead><tr><th>Ngày</th><th>Công ty</th><th>Tài khoản</th><th>Đối tượng</th><th>Diễn giải</th><th>Hạng mục</th><th>Chứng từ</th>
      <th class="num">Thu</th><th class="num">Chi</th>${hasBal ? html`<th class="num">Số dư</th>` : ''}</tr></thead><tbody>${body}</tbody>
      <tfoot><tr><td colspan="7">Cộng phát sinh${data.truncated ? ' (đã giới hạn số dòng hiển thị)' : ''}</td><td class="num in">${money(data.inflow)}</td><td class="num out">${money(data.outflow)}</td>${hasBal ? html`<td class="num">${money(data.closing)}</td>` : ''}</tr></tfoot></table>`);
  };
  const onF = () => {
    Object.assign(f, { company_id: $('#l-company').value, account_id: $('#l-account').value, category_id: $('#l-category').value });
    if (day) f.date = $('#l-date').value; else f.month = $('#l-month').value;
    accOpts(); f.account_id = $('#l-account').value; load();
  };
  el.querySelectorAll('.filters select, .filters input').forEach((x) => { x.onchange = onF; });
  $('#l-print').onclick = () => window.print();
  $('#l-csv').onclick = () => downloadCSV(`so-quy-${day ? f.date : f.month}.csv`,
    ['Ngày', 'Công ty', 'Tài khoản', 'Đối tượng', 'Diễn giải', 'Hạng mục', 'Nguồn', 'Số CT', 'Thu', 'Chi', 'Số dư'],
    data.rows.map((r) => [r.txn_date, r.company_code, r.account_code, r.counterparty, r.description, r.category, r.source, r.doc_id, r.amount_in, r.amount_out, r.balance ?? '']));
  $('#l-table').onclick = (e) => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    if (moduleMeta(tr.dataset.m)) openDoc(tr.dataset.m, +tr.dataset.id, load);
  };
  await load();
};

// ================================================================ tổng hợp
export const renderSummary = (mode) => async (el, _p, query) => {
  const day = mode === 'day';
  setTitle(day ? 'Tổng hợp theo ngày' : 'Tổng hợp theo tháng', 'Báo cáo · Số dư & phát sinh theo công ty, tài khoản');
  const f = { date: query.date || todayStr(), month: query.month || todayStr().slice(0, 7), company_id: query.company_id || '' };
  el.innerHTML = String(html`
    <div class="page-head"><div><h2>${day ? 'Tổng hợp thu chi theo ngày' : 'Tổng hợp thu chi theo tháng'}</h2><p>"Thu / chi thực" đã loại các khoản nội bộ (chuyển giữa các TK, rút / nộp tiền mặt).</p></div></div>
    <div class="card mb"><div class="card-b filters">
      ${day ? html`<input class="input" type="date" id="s-date" value="${f.date}">` : html`<input class="input" type="month" id="s-month" value="${f.month}">`}
      <select class="input" id="s-company">${companyOpts(f.company_id)}</select>
      <div class="sp"></div><button class="btn" id="s-csv">${icon('download')} Xuất CSV</button><button class="btn icon" id="s-print">${icon('printer')}</button>
    </div></div><div id="s-body"><div class="spinner"></div></div>`);
  let d;
  const load = async () => {
    setQuery(f);
    d = day ? await api('/reports/summary-day', { query: { date: f.date, company_id: f.company_id } })
      : await api('/reports/summary-month', { query: { month: f.month, company_id: f.company_id } });
    drawSummary($('#s-body'), d, day);
  };
  el.querySelectorAll('.filters select, .filters input').forEach((x) => { x.onchange = () => { f.company_id = $('#s-company').value; if (day) f.date = $('#s-date').value; else f.month = $('#s-month').value; load(); }; });
  $('#s-print').onclick = () => window.print();
  $('#s-csv').onclick = () => downloadCSV(`tong-hop-${day ? f.date : f.month}.csv`,
    ['Nhóm', 'Công ty', 'Tên công ty', 'Đầu kỳ', 'Tổng thu', 'Tổng chi', 'Thu thực', 'Chi thực', 'Cuối kỳ', 'Ngân hàng', 'Tiền mặt'],
    d.companies.map((c) => [c.group, c.code, c.name, c.opening, c.inflow, c.outflow, c.real_in, c.real_out, c.closing, c.bank, c.cash]));
  await load();
};

function drawSummary(el, d, day) {
  const t = d.total;
  const groups = [...new Set(d.companies.map((c) => c.group))];
  const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const cols = ['opening', 'inflow', 'outflow', 'real_in', 'real_out', 'closing', 'bank', 'cash'];
  el.innerHTML = String(html`
    <div class="grid g4 mb">${card('Số dư đầu kỳ', money(t.opening))}${card('Thu thực', money(t.real_in), 'in', `Tổng thu: ${money(t.inflow)}`)}
      ${card('Chi thực', money(t.real_out), 'out', `Tổng chi: ${money(t.outflow)}`)}${card('Số dư cuối kỳ', money(t.closing), '', `NH ${money(t.bank)} · TM ${money(t.cash)}`)}</div>
    <div class="card mb"><div class="card-h"><h3>Theo công ty</h3><span class="muted small">${day ? date(d.date) : monthLabel(d.month)}</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Công ty</th><th class="num">Đầu kỳ</th><th class="num">Tổng thu</th><th class="num">Tổng chi</th><th class="num">Thu thực</th><th class="num">Chi thực</th>
        <th class="num">Cuối kỳ</th><th class="num">Ngân hàng</th><th class="num">Tiền mặt</th></tr></thead>
      <tbody>${groups.map((g) => { const rows = d.companies.filter((c) => c.group === g); return html`
        <tr class="grp"><td>${g}</td>${cols.map((k) => html`<td class="num">${money(sum(rows, k))}</td>`)}</tr>
        ${rows.map((c) => html`<tr><td><b>${c.code}</b> <span class="small muted">${c.name}</span>${c.alerts ? html` <span class="badge st-cancelled plain">${c.alerts} cảnh báo</span>` : ''}</td>
          <td class="num">${money(c.opening)}</td><td class="num in">${money(c.inflow)}</td><td class="num out">${money(c.outflow)}</td><td class="num">${money(c.real_in)}</td><td class="num">${money(c.real_out)}</td>
          <td class="num"><b>${money(c.closing)}</b></td><td class="num">${money(c.bank)}</td><td class="num">${money(c.cash)}</td></tr>`)}`; })}</tbody>
      <tfoot><tr><td>Tổng cộng</td>${cols.map((k) => html`<td class="num">${money(sum(d.companies, k))}</td>`)}</tr></tfoot></table></div></div>

    <div class="card mb"><div class="card-h"><h3>Theo tài khoản ngân hàng & quỹ tiền mặt</h3></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tài khoản</th><th>Công ty</th><th>Loại</th><th class="num">Đầu kỳ</th><th class="num">Thu</th><th class="num">Chi</th><th class="num">Cuối kỳ</th><th>Cảnh báo</th></tr></thead>
      <tbody>${d.accounts.map((a) => html`<tr><td><b>${a.code}</b></td><td>${a.company_code}</td><td>${a.kind === 'cash' ? html`<span class="badge st-submitted plain">Tiền mặt</span>` : a.bank_code}</td>
        <td class="num">${money(a.opening)}</td><td class="num in">${money(a.inflow)}</td><td class="num out">${money(a.outflow)}</td><td class="num"><b>${money(a.closing)}</b></td>
        <td>${a.alert ? html`<span class="badge st-cancelled">${a.alert}</span>` : ''}</td></tr>`)}</tbody></table></div></div>
    ${day ? '' : monthExtras(d)}`);
}

function monthExtras(d) {
  const tbl = (title, rows, headers, row) => html`<div class="card"><div class="card-h"><h3>${title}</h3></div>${rows.length ? html`<div class="tbl-wrap"><table class="tbl"><thead><tr>${headers.map((h) => html`<th class="${h.startsWith('#') ? 'num' : ''}">${h.replace('#', '')}</th>`)}</tr></thead><tbody>${rows.map(row)}</tbody></table></div>` : empty()}</div>`;
  return html`
    <div class="card mb"><div class="card-h"><h3>Diễn biến theo ngày</h3></div><div class="card-b">${combo({ labels: d.daily.map((x) => x.date), width: 1100, height: 240, fmtX: (x) => x.slice(8),
      series: [{ name: 'Thu thực', color: '#34c18f', values: d.daily.map((x) => x.real_in) }, { name: 'Chi thực', color: '#f07a68', values: d.daily.map((x) => x.real_out) },
        { name: 'Tổng số dư (trục phải)', color: '#1f4fd8', type: 'line', axis: 'right', values: d.daily.map((x) => x.total) }] })}</div></div>
    <div class="grid g2 mb">
      ${tbl('Theo hạng mục thu chi', d.categories, ['Hạng mục', 'Tính chất', '#Thu', '#Chi'], (c) => html`<tr><td>${c.name}</td><td class="small">${label(c.nature)}</td><td class="num in">${money(c.inflow)}</td><td class="num out">${money(c.outflow)}</td></tr>`)}
      ${tbl('Tạm ứng nhân viên', d.advances, ['Nhân viên', '#Tạm ứng', '#Đã hoàn / QT', '#Còn phải hoàn'], (a) => html`<tr><td>${a.person}</td><td class="num">${money(a.advanced)}</td><td class="num">${money(a.refunded + a.settled)}</td><td class="num"><b>${money(a.outstanding)}</b></td></tr>`)}
    </div>
    <div class="grid g2 mb">
      ${tbl('Khoản vay', d.loans, ['Số HĐ', 'Bên cho vay', '#Đã nhận', '#Đã trả gốc', '#Dư nợ', 'Tình trạng'], (l) => html`<tr><td><b>${l.contract_no}</b></td><td>${l.lender || ''}</td><td class="num">${money(l.received)}</td><td class="num">${money(l.repaid)}</td><td class="num"><b>${money(l.outstanding)}</b></td><td class="small">${l.state}</td></tr>`)}
      ${tbl('Lương', d.payroll, ['Công ty', '#Số NV', '#Thực lĩnh', '#Đã chi', '#Chờ duyệt'], (p) => html`<tr><td><b>${p.company}</b></td><td class="num">${p.employees}</td><td class="num">${money(p.net)}</td><td class="num">${money(p.paid)}</td><td class="num">${money(p.pending)}</td></tr>`)}
    </div>
    <div class="grid g2">
      ${tbl('Thanh toán đối tác', d.partners, ['Đối tác', '#Trong tháng', '#Lũy kế', '#Chờ duyệt'], (p) => html`<tr><td>${p.partner}</td><td class="num">${money(p.paid_month)}</td><td class="num">${money(p.paid_total)}</td><td class="num">${money(p.pending)}</td></tr>`)}
      ${tbl('Điều chuyển nội bộ', d.intercompany, ['Công ty', '#Chuyển đi', '#Nhận về', '#Lũy kế'], (p) => html`<tr><td>${p.company}</td><td class="num">${money(p.sent_month)}</td><td class="num">${money(p.recv_month)}</td><td class="num">${money(p.balance)}</td></tr>`)}
    </div>`;
}

// ================================================================ kiểm soát hạch toán
export async function renderControl(el) {
  setTitle('Kiểm soát hạch toán', 'Đối chiếu chứng từ đã duyệt với sổ cái');
  const d = await api('/reports/control');
  const ok = (v) => (v ? html`<span class="badge st-posted">Khớp</span>` : html`<span class="badge st-cancelled">Lệch</span>`);
  el.innerHTML = String(html`
    <div class="page-head"><div><h2>Kiểm soát hạch toán</h2><p>Hệ thống tính lại bút toán từ toàn bộ chứng từ đã duyệt và so với sổ cái. Mọi dòng phải "Khớp".</p></div></div>
    <div class="note ${d.ok ? 'info' : 'err'}">${icon(d.ok ? 'shield' : 'alert')}<div><b>${d.ok ? 'Toàn bộ sổ cái khớp với chứng từ.' : 'Phát hiện chênh lệch — cần kiểm tra!'}</b>
      ${d.orphans ? html` Có ${d.orphans} bút toán không gắn chứng từ hợp lệ.` : ''}</div></div>
    <div class="card mb"><div class="card-h"><h3>Theo nghiệp vụ</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nghiệp vụ</th><th class="num">CT đã ghi sổ</th><th class="num">Đang chờ duyệt</th>
      <th class="num">Thu (chứng từ)</th><th class="num">Thu (sổ cái)</th><th class="num">Chi (chứng từ)</th><th class="num">Chi (sổ cái)</th><th>Kết quả</th></tr></thead>
      <tbody>${d.modules.map((m) => html`<tr><td><b>${m.title}</b></td><td class="num">${m.docs}</td><td class="num">${m.pending}</td><td class="num">${money(m.src_in)}</td><td class="num">${money(m.led_in)}</td>
        <td class="num">${money(m.src_out)}</td><td class="num">${money(m.led_out)}</td><td>${ok(m.ok)}</td></tr>`)}</tbody></table></div></div>
    <div class="card"><div class="card-h"><h3>Theo tài khoản</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tài khoản</th><th>Công ty</th><th class="num">Số dư đầu</th>
      <th class="num">Số dư theo chứng từ</th><th class="num">Số dư theo sổ cái</th><th class="num">Chênh lệch</th><th>Kết quả</th></tr></thead>
      <tbody>${d.accounts.map((a) => html`<tr><td><b>${a.code}</b></td><td>${a.company}</td><td class="num">${money(a.opening)}</td><td class="num">${money(a.src_balance)}</td>
        <td class="num">${money(a.led_balance)}</td><td class="num ${a.src_balance !== a.led_balance ? 'out' : ''}">${money(a.src_balance - a.led_balance)}</td><td>${ok(a.ok)}</td></tr>`)}</tbody></table></div></div>`);
}
