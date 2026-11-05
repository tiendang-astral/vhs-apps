// Phân hệ Khoản vay: Dashboard vay, danh sách khoản vay / hạn mức, lịch trả nợ 90 ngày, chi tiết khoản vay.
import { $, api, date, empty, html, icon, money, monthLabel, overlay, showError } from '../core.js';
import { donut, hbars } from '../charts.js';
import { myCompanies, state } from '../state.js';
import { setQuery, setTitle } from '../app.js';
import { openDoc } from './docs.js';

const kpi = (lbl, val, sub = '', cls = '') => html`<div class="card kpi"><div class="lbl">${lbl}</div><div class="val ${cls}">${val}</div><div class="sub">${sub}</div></div>`;
const STATUS_CLS = { 'Đang vay': 'st-pay', 'Chờ giải ngân': 'st-chair', 'Đã tất toán': 'st-posted', 'Hạn mức': 'st-ctl' };
const WARN_CLS = (w) => (w.startsWith('QUÁ') || w.startsWith('Đến hạn ≤7') ? 'st-cancelled' : w.startsWith('Đến hạn') ? 'st-submitted' : 'st-reopen');
const rate = (r) => (r == null ? '—' : String(r).replace('.', ',') + '%');
const canDossier = () => state.meta.modules.some((m) => m.key === 'loan' && m.can_create);

export async function renderLoans(el, _p, query) {
  setTitle('Khoản vay', 'Tổng quan · Dư nợ tính từ chứng từ đã ghi sổ');
  const f = { company_id: query.company_id || '', tab: query.tab || 'loan' };
  el.innerHTML = String(html`
    <div class="page-head"><div><h2>Khoản vay</h2><p>Dư nợ = giải ngân − trả gốc đã ghi sổ. Thay đổi khoản vay qua <a href="#/docs/loan">Hồ sơ vay</a> (Chủ tịch duyệt cuối).</p></div><div class="sp"></div>
      ${canDossier() ? html`<a class="btn primary" href="#/docs/loan">${icon('plus')} Lập hồ sơ vay</a>` : ''}</div>
    <div class="grid g4 mb" id="ln-kpi"><div class="spinner"></div></div>
    <div class="grid g3 mb" id="ln-charts"></div>
    <div class="card mb"><div class="card-h"><div class="tabs" id="ln-tabs"></div><div class="sp"></div>
      <select class="input" id="ln-co" style="max-width:260px"><option value="">Tất cả công ty phụ trách</option>
      ${myCompanies().map((c) => html`<option value="${c.id}" ${String(c.id) === f.company_id ? 'selected' : ''}>${c.code} – ${c.name}</option>`)}</select></div>
      <div class="tbl-wrap" id="ln-table"></div></div>`);
  let dash, list;
  const drawTabs = () => {
    $('#ln-tabs').innerHTML = String(html`${[['loan', 'Khoản vay'], ['limit', 'Hạn mức'], ['schedule', 'Lịch trả nợ 90 ngày'], ['warn', 'Cảnh báo'], ['cross', 'Bảo lãnh chéo']]
      .map(([k, t]) => html`<button class="${f.tab === k ? 'on' : ''}" data-tab="${k}">${t}</button>`)}`);
  };
  const table = () => {
    const box = $('#ln-table');
    if (f.tab === 'schedule') {
      const s = dash.schedule;
      box.innerHTML = String(s.rows.length ? html`<table class="tbl"><thead><tr><th>Ngày</th><th>Khoản vay</th><th>Công ty</th><th>Bên cho vay</th><th class="num">Gốc</th><th class="num">Lãi (ước tính)</th><th class="num">Dư nợ sau kỳ</th></tr></thead>
        <tbody>${s.rows.map((r) => html`<tr class="click" data-loan="${r.loan_id}"><td>${date(r.date)}</td><td><b>${r.code}</b></td><td>${r.company_code}</td><td>${r.lender}</td>
          <td class="num out">${money(r.principal || '')}</td><td class="num">${money(r.interest || '')}</td><td class="num">${money(r.balance_after)}</td></tr>`)}</tbody>
        <tfoot><tr><td colspan="4">Tổng 90 ngày tới</td><td class="num">${money(s.principal)}</td><td class="num">${money(s.interest)}</td><td></td></tr></tfoot></table>` : empty('Không có kỳ trả nợ trong 90 ngày tới'));
      return;
    }
    if (f.tab === 'warn') {
      box.innerHTML = String(dash.warnings.length ? html`<table class="tbl"><thead><tr><th>Khoản vay</th><th>Công ty</th><th class="num">Dư nợ</th><th>Cảnh báo</th></tr></thead>
        <tbody>${dash.warnings.map((w) => html`<tr class="click" data-loan="${w.id}"><td><b>${w.code}</b></td><td>${w.company_code}</td><td class="num">${money(w.outstanding)}</td>
          <td>${w.warnings.map((x) => html`<span class="badge ${WARN_CLS(x)}">${x}</span> `)}</td></tr>`)}</tbody></table>` : empty('Không có cảnh báo', 'check'));
      return;
    }
    if (f.tab === 'cross') {
      const c = dash.cross_guarantees;
      box.innerHTML = String(c.length ? html`<table class="tbl"><thead><tr><th>Khoản vay</th><th>Công ty vay</th><th>Công ty bảo đảm / bảo lãnh</th><th>Tài sản / nội dung</th><th class="num">Giá trị</th><th>Hạn bảo hiểm</th></tr></thead>
        <tbody>${c.map((r) => html`<tr class="click" data-loan="${r.loan_id}"><td><b>${r.code}</b></td><td>${r.borrower}</td><td><b>${r.owner}</b></td><td class="clip">${r.description}</td><td class="num">${money(r.value || '')}</td><td>${date(r.insurance_expiry)}</td></tr>`)}</tbody></table>`
        : empty('Chưa có tài sản bảo đảm / bảo lãnh của công ty khác'));
      return;
    }
    const rows = list.filter((r) => r.kind === f.tab);
    if (!rows.length) { box.innerHTML = String(empty(f.tab === 'limit' ? 'Chưa có hạn mức tín dụng' : 'Chưa có khoản vay – Ngân quỹ lập Hồ sơ vay để bắt đầu')); return; }
    const tot = rows.reduce((a, r) => a + (r.status === 'Đang vay' || r.kind === 'limit' ? r.outstanding : 0), 0);
    box.innerHTML = String(f.tab === 'limit'
      ? html`<table class="tbl"><thead><tr><th>Mã hạn mức</th><th>Công ty</th><th>Bên cho vay</th><th>Số HĐ</th><th class="num">Hạn mức</th><th class="num">Đang sử dụng</th><th class="num">Còn lại</th><th>Hết hạn</th></tr></thead>
        <tbody>${rows.map((r) => html`<tr class="click" data-loan="${r.id}"><td><b>${r.code}</b></td><td>${r.company_code}</td><td>${r.lender}</td><td>${r.contract_no || ''}</td>
          <td class="num">${money(r.amount)}</td><td class="num">${money(r.outstanding)}</td><td class="num in">${money(r.available)}</td><td>${date(r.maturity_date)}</td></tr>`)}</tbody></table>`
      : html`<table class="tbl"><thead><tr><th>Mã</th><th>Công ty</th><th>Bên cho vay</th><th>Kỳ hạn</th><th class="num">Số tiền vay</th><th class="num">Dư nợ</th><th class="num">Lãi suất</th><th>Đáo hạn</th><th>Trạng thái</th><th>Cảnh báo</th></tr></thead>
        <tbody>${rows.map((r) => html`<tr class="click" data-loan="${r.id}"><td><b>${r.code}</b></td><td>${r.company_code}</td><td>${r.lender}</td><td>${r.term || ''}</td>
          <td class="num">${money(r.amount)}</td><td class="num" style="font-weight:600">${money(r.outstanding)}</td><td class="num">${rate(r.rate)}</td><td>${date(r.maturity_date)}</td>
          <td><span class="badge ${STATUS_CLS[r.status] || ''}">${r.status}</span></td><td>${r.warnings.map((x) => html`<span class="badge ${WARN_CLS(x)}">${x}</span> `)}</td></tr>`)}</tbody>
        <tfoot><tr><td colspan="5">Tổng dư nợ đang vay</td><td class="num">${money(tot)}</td><td colspan="4"></td></tr></tfoot></table>`);
  };
  const load = async () => {
    setQuery(f);
    try {
      [dash, list] = await Promise.all([api('/loans/dashboard'), api('/loans', { query: { company_id: f.company_id } })]);
    } catch (e) { return showError(e); }
    $('#ln-kpi').innerHTML = String(html`
      ${kpi('Tổng dư nợ đang vay', money(dash.total), `${dash.count} khoản · ngắn hạn ${money(dash.short)} · dài hạn ${money(dash.long)}`)}
      ${kpi('Lãi suất bình quân', dash.avg_rate == null ? '—' : rate(dash.avg_rate), 'bình quân gia quyền theo dư nợ')}
      ${kpi('Đến hạn trong 30 ngày', money(dash.due30), `31–90 ngày: ${money(dash.due90)}`, dash.due30 ? 'out' : '')}
      ${kpi('Quá hạn', money(dash.overdue), dash.check_ok ? 'Đối chiếu tổng: KHỚP' : 'Đối chiếu tổng: LỆCH', dash.overdue ? 'out' : 'in')}`);
    $('#ln-charts').innerHTML = String(html`
      <div class="card"><div class="card-h"><h3>Dư nợ theo công ty</h3></div><div class="card-b">${donut(dash.by_company.map((x) => ({ label: x.name, value: x.total })), { sub: 'đồng' })}</div></div>
      <div class="card"><div class="card-h"><h3>Theo bên cho vay</h3></div><div class="card-b">${hbars(dash.by_lender.map((x) => ({ label: x.name, value: x.total })))}</div></div>
      <div class="card"><div class="card-h"><h3>Ngắn hạn / dài hạn</h3></div><div class="card-b">${donut([{ label: 'Ngắn hạn', value: dash.short, color: '#e0a526' }, { label: 'Dài hạn', value: dash.long, color: '#0e7c86' }], { sub: 'đồng' })}</div></div>`);
    drawTabs(); table();
  };
  el.onclick = (e) => {
    const t = e.target.closest('[data-tab]'); if (t) { f.tab = t.dataset.tab; drawTabs(); table(); setQuery(f); return; }
    const r = e.target.closest('[data-loan]'); if (r) openLoan(+r.dataset.loan);
  };
  $('#ln-co').onchange = (e) => { f.company_id = e.target.value; load(); };
  await load();
}

export async function openLoan(id) {
  const { el, close } = overlay('<div class="spinner"></div>', { kind: 'drawer' });
  let d;
  try { d = await api(`/loans/${id}`); } catch (e) { close(); return showError(e); }
  const row = (k, v) => (v == null || v === '' ? '' : html`<dt>${k}</dt><dd>${v}</dd>`);
  el.innerHTML = String(html`
    <div class="modal-h"><div><div class="small muted">${d.kind === 'limit' ? 'Hạn mức tín dụng' : 'Khoản vay'} · ${d.company_code}</div><h3 style="margin-top:2px">${d.code} – ${d.lender}</h3></div>
      <div class="sp"></div><button class="btn ghost icon" data-close>${icon('x')}</button></div>
    <div class="modal-b">
      <div class="amount-hero"><div><div class="small muted">${d.kind === 'limit' ? 'Đang sử dụng / hạn mức' : 'Dư nợ hiện tại'}</div>
        <b>${money(d.outstanding)} ₫</b><div class="small muted">${d.kind === 'limit' ? `Hạn mức ${money(d.amount)} · còn lại ${money(d.available)}` : `Đã giải ngân ${money(d.disbursed)} / ${money(d.amount)} · đã trả gốc ${money(d.repaid)} · đã trả lãi ${money(d.interest_paid)}`}</div></div>
        <span class="badge ${STATUS_CLS[d.status] || ''}">${d.status}</span></div>
      ${d.warnings.length ? html`<div class="note">${icon('alert')}<div>${d.warnings.join(' · ')}</div></div>` : ''}
      <div class="sec-t">Thông tin</div>
      <dl class="dl">${row('Số HĐ tín dụng', d.contract_no)}${row('Số khế ước', d.drawdown_no)}${row('Loại bên cho vay', d.lender_type)}${row('Kỳ hạn', d.term)}
        ${row('Hiệu lực / giải ngân', date(d.start_date))}${row('Đáo hạn', date(d.maturity_date))}${row('Lãi suất', d.kind === 'loan' ? `${rate(d.rate)} ${d.rate_type ? '· ' + d.rate_type : ''}` : '')}
        ${row('Ngày trả lãi', d.interest_day ? `ngày ${d.interest_day} hằng tháng` : '')}${row('Cách trả gốc', d.repay_method)}${row('Mục đích', d.purpose)}${row('TSĐB / bảo lãnh', d.collateral)}</dl>
      ${d.kind === 'loan' ? html`<div class="sec-t">Lịch trả nợ dự kiến</div>${d.schedule.length ? html`<div class="card"><table class="tbl"><thead><tr><th>Kỳ</th><th class="num">Gốc</th><th class="num">Lãi ước tính</th><th class="num">Dư nợ sau kỳ</th></tr></thead>
        <tbody>${d.schedule.slice(0, 24).map((k) => html`<tr><td>${date(k.date)}</td><td class="num out">${money(k.principal || '')}</td><td class="num">${money(k.interest)}</td><td class="num">${money(k.balance_after)}</td></tr>`)}</tbody></table></div>` : html`<p class="muted small">Không còn kỳ trả.</p>`}` : ''}
      ${d.children ? html`<div class="sec-t">Khế ước thuộc hạn mức</div><div class="card"><table class="tbl"><tbody>${d.children.map((c) => html`<tr><td><b>${c.code}</b></td><td>${date(c.maturity_date)}</td><td class="num">${money(c.outstanding)}</td><td>${c.status}</td></tr>`)}</tbody></table></div>` : ''}
      <div class="sec-t">Giải ngân, trả nợ (Thu Chi & Vay nợ)</div>
      ${d.transactions.length ? html`<div class="card"><table class="tbl"><tbody>${d.transactions.map((t) => html`<tr class="click" data-doc="cashbook:${t.id}"><td class="muted">#${t.id}</td><td>${date(t.doc_date)}</td><td>${t.kind}</td>
        <td class="num">${money(t.amount)}</td><td><span class="badge st-${t.status}">${state.meta.status[t.status] || t.status}</span></td></tr>`)}</tbody></table></div>` : html`<p class="muted small">Chưa có chứng từ.</p>`}
      <div class="sec-t">Hồ sơ vay</div>
      <div class="card"><table class="tbl"><tbody>${d.dossiers.map((t) => html`<tr class="click" data-doc="loan:${t.id}"><td class="muted">#${t.id}</td><td>${date(t.doc_date)}</td><td>${t.kind}</td>
        <td><span class="badge st-${t.status}">${state.meta.status[t.status] || t.status}</span></td></tr>`)}</tbody></table></div>
      ${d.collaterals.length ? html`<div class="sec-t">Tài sản bảo đảm / bảo lãnh</div><div class="card"><table class="tbl"><tbody>${d.collaterals.map((c) => html`<tr><td>${c.description}</td><td>${c.owner_code || ''}</td><td class="num">${money(c.value || '')}</td><td>${c.insurance_expiry ? 'BH đến ' + date(c.insurance_expiry) : ''}</td></tr>`)}</tbody></table></div>` : ''}
      ${d.recons.length ? html`<div class="sec-t">Đối chiếu dư nợ</div><div class="card"><table class="tbl"><thead><tr><th>Tháng</th><th class="num">Theo sổ</th><th class="num">Theo NH</th><th class="num">Chênh lệch</th></tr></thead><tbody>${d.recons.map((r) => html`<tr><td>${monthLabel(r.period + '-01')}</td><td class="num">${money(r.book_balance)}</td><td class="num">${money(r.bank_balance)}</td><td class="num ${r.diff ? 'out' : 'in'}">${money(r.diff)}</td></tr>`)}</tbody></table></div>` : ''}
    </div>`);
  el.onclick = (e) => {
    const r = e.target.closest('[data-doc]'); if (!r) return;
    const [m, i] = r.dataset.doc.split(':');
    if (state.meta.modules.some((x) => x.key === m)) openDoc(m, +i);
  };
}
