// Dashboard điều hành: Admin tập đoàn xem toàn bộ (lọc theo nhóm), GĐ công ty trụ cột xem nhóm được giao.
import { $, api, date, empty, html, icon, money, monthLabel, moneyShort, pct, todayStr } from '../core.js';
import { combo, donut, hbars, PALETTE } from '../charts.js';
import { setQuery, setTitle } from '../app.js';
import { isAdmin } from '../state.js';

const kpi = (lbl, val, sub, ic, tone, extra = '') => html`<div class="card kpi ${tone === 'hero' ? 'hero' : ''}">
  <div class="lbl"><span class="ic ${tone === 'hero' ? '' : 'tone-' + tone}">${icon(ic)}</span>${lbl}</div>
  <div class="val">${val}</div><div class="sub">${sub}${extra}</div></div>`;

export async function renderDashboard(el, _p, query) {
  const admin = isAdmin();
  setTitle('Dashboard', admin ? 'Tổng quan dòng tiền toàn tập đoàn' : 'Tổng quan dòng tiền nhóm công ty trụ cột');
  const f = { month: query.month || todayStr().slice(0, 7), date: query.date || todayStr(), group_id: query.group_id || '' };
  el.innerHTML = String(html`
    <div class="page-head"><div><h2>Dashboard điều hành <span class="scope-chip" id="d-scope"></span></h2>
      <p>Số liệu chỉ gồm chứng từ đã được Admin tập đoàn duyệt cuối và ghi sổ.${admin ? '' : ' Bạn đang xem các công ty thuộc nhóm trụ cột được giao.'}</p></div><div class="sp"></div>
      <div class="filters"><select class="input" id="d-group" title="Nhóm công ty trụ cột"></select><label class="small muted">Tháng</label><input class="input" type="month" id="d-month" value="${f.month}">
      <label class="small muted">Ngày</label><input class="input" type="date" id="d-date" value="${f.date}">
      <button class="btn icon" id="d-print" title="In">${icon('printer')}</button></div></div>
    <div id="dash"><div class="spinner"></div></div>`);
  const load = async () => {
    setQuery(f);
    const d = await api('/reports/dashboard', { query: f });
    const sel = $('#d-group');
    sel.innerHTML = String(html`<option value="">${admin ? 'Toàn tập đoàn' : 'Tất cả nhóm được giao'}</option>${d.group_options.map((g) => html`<option value="${g.id}">${g.name}</option>`)}`);
    sel.value = f.group_id || '';
    sel.classList.toggle('hidden', !admin && d.group_options.length < 2);
    $('#d-scope').textContent = d.scope_label;
    draw($('#dash'), d);
  };
  $('#d-month').onchange = (e) => { f.month = e.target.value; if (f.date.slice(0, 7) !== f.month) f.date = lastDay(f.month); $('#d-date').value = f.date; load(); };
  $('#d-date').onchange = (e) => { f.date = e.target.value; load(); };
  $('#d-group').onchange = (e) => { f.group_id = e.target.value; load(); };
  $('#d-print').onclick = () => window.print();
  await load();
}
const lastDay = (m) => { const [y, mo] = m.split('-').map(Number); const t = todayStr(); const ld = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10); return ld > t && t.startsWith(m) ? t : ld; };

function draw(el, d) {
  const k = d.kpi, delta = k.prev_net ? (k.net - k.prev_net) / Math.abs(k.prev_net) : null;
  const pending = Object.values(d.pending).reduce((a, s) => a + (s.submitted || 0) + (s.l1_approved || 0) + (s.dir_approved || 0), 0);
  const funds = d.cash_funds.filter((c) => ['opening', 'fund_in', 'other_in', 'employee_adv', 'other_out', 'returned', 'closing', 'at_day'].some((k) => c[k]));
  // 1 nhóm (GĐ công ty trụ cột hoặc đang lọc 1 nhóm) → chia theo công ty; nhiều nhóm → chia theo nhóm
  const groups = d.groups.filter((g) => d.companies.some((c) => c.group === g.name));
  const pie = groups.length > 1 ? { title: 'Số dư theo nhóm công ty', items: groups.map((g) => ({ label: g.name, value: g.closing })) }
    : { title: `Số dư theo công ty${groups[0] ? ' – ' + groups[0].name : ''}`, items: d.companies.map((c) => ({ label: c.code, value: c.closing })) };
  const daily = d.daily.filter((x) => x.date <= d.day || x.date.slice(0, 7) !== d.month);
  el.innerHTML = String(html`
    <div class="grid g4">
      ${kpi('Tổng số dư cuối tháng', money(k.total), html`NH ${moneyShort(k.bank)} · Tiền mặt ${moneyShort(k.cash)}`, 'wallet', 'hero')}
      ${kpi('Thu thực trong tháng', money(k.real_in), 'Đã loại chuyển tiền nội bộ', 'trend', 'in')}
      ${kpi('Chi thực trong tháng', money(k.real_out), 'Đã loại chuyển tiền nội bộ', 'swap', 'out')}
      ${kpi('Dòng tiền ròng', money(k.net), 'So với tháng trước ', 'chart', k.net >= 0 ? 'info' : 'warn',
        delta == null ? '' : html`<span class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${pct(Math.abs(delta))}</span>`)}
    </div>
    <div class="grid g4 mt">
      ${kpi(`Số dư ngày ${date(d.day)}`, money(k.day_total), html`<span class="in">+${moneyShort(k.day_in)}</span> · <span class="out">−${moneyShort(k.day_out)}</span> trong ngày`, 'calendar', 'info')}
      ${kpi('Dư nợ vay', money(k.loan_outstanding), `${d.loans.filter((l) => l.outstanding > 0).length} hợp đồng đang vay`, 'bank', 'violet')}
      ${kpi('Tạm ứng chưa hoàn', money(k.advances_outstanding), 'Nhân viên đang giữ tạm ứng', 'partner', 'warn')}
      ${kpi('Chứng từ đang chờ duyệt', pending, html`<a href="#/inbox">Mở hộp chờ duyệt →</a>`, 'inbox', pending ? 'out' : 'in')}
    </div>
    ${d.alerts.length ? html`<div class="note err mt">${icon('alert')}<div><b>Cảnh báo số dư:</b> ${d.alerts.map((a) => html`<div>${a.code} (${a.company_code}): ${a.alert} – số dư ${money(a.closing)}</div>`)}</div></div>` : ''}

    <div class="grid g-21 mt">
      <div class="card"><div class="card-h"><h3>Xu hướng 12 tháng</h3><span class="muted small">Thu / chi thực & tổng số dư</span></div>
        <div class="card-b">${combo({ labels: d.trend.map((t) => t.month), fmtX: monthLabel, height: 270, series: [
          { name: 'Thu thực', color: '#0e9f6e', values: d.trend.map((t) => t.real_in) },
          { name: 'Chi thực', color: '#e0452f', values: d.trend.map((t) => t.real_out) },
          { name: 'Tổng số dư (trục phải)', color: '#1f4fd8', type: 'line', axis: 'right', values: d.trend.map((t) => t.closing) }] })}</div></div>
      <div class="card"><div class="card-h"><h3>${pie.title}</h3></div>
        <div class="card-b">${donut(pie.items, { sub: 'tổng số dư' })}
        <table class="tbl mt"><tbody>${pie.items.map((g) => html`<tr><td>${g.label}</td><td class="num"><b>${money(g.value)}</b></td></tr>`)}</tbody></table></div></div>
    </div>

    <div class="grid g-21 mt">
      <div class="card"><div class="card-h"><h3>Diễn biến trong tháng ${monthLabel(d.month)}</h3><span class="muted small">Theo ngày</span></div>
        <div class="card-b">${combo({ labels: daily.map((x) => x.date), fmtX: (x) => x.slice(8) + '/' + x.slice(5, 7), height: 250, width: 760, series: [
          { name: 'Thu thực', color: '#34c18f', values: daily.map((x) => x.real_in) },
          { name: 'Chi thực', color: '#f07a68', values: daily.map((x) => x.real_out) },
          { name: 'Tổng số dư cuối ngày (trục phải)', color: '#1f4fd8', type: 'area', axis: 'right', values: daily.map((x) => x.total) }] })}</div></div>
      <div class="card"><div class="card-h"><h3>Số dư theo ngân hàng</h3></div>
        <div class="card-b">${donut(d.banks.map((b) => ({ label: b.bank === 'TM' || !b.bank ? 'Tiền mặt' : b.bank, value: b.closing })), { sub: 'NH & tiền mặt' })}</div></div>
    </div>

    <div class="grid g2 mt">
      <div class="card"><div class="card-h"><h3>Số dư theo công ty</h3><div class="sp"></div><a class="small" href="#/summary-month?month=${d.month}">Chi tiết →</a></div>
        <div class="card-b">${d.companies.length ? hbars(d.companies.map((c) => ({ label: c.code, title: c.name, value: c.closing }))) : empty()}</div></div>
      <div class="card"><div class="card-h"><h3>Chi theo hạng mục</h3><span class="muted small">Tháng ${monthLabel(d.month)}</span></div>
        <div class="card-b">${d.categories.length ? hbars(d.categories.filter((c) => c.outflow).map((c) => ({ label: c.name, value: c.outflow })), { color: 'linear-gradient(90deg,#f59e0b,#e0452f)' }) : empty()}</div></div>
    </div>

    <div class="card mt"><div class="card-h"><h3>Quỹ tiền mặt các công ty</h3><span class="muted small">Tháng ${monthLabel(d.month)} · tồn tại ngày ${date(d.day)}</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Công ty</th><th>Thủ quỹ</th><th class="num">Tồn đầu tháng</th><th class="num">Nhận tạm ứng quỹ</th><th class="num">Thu khác</th>
        <th class="num">Tạm ứng NV</th><th class="num">Chi khác</th><th class="num">Hoàn về NH</th><th class="num">Tồn cuối tháng</th><th class="num">Tồn ngày chọn</th></tr></thead>
      <tbody>${funds.map((c) => html`<tr><td><b>${c.company}</b></td><td>${c.holder || ''}</td><td class="num">${money(c.opening)}</td><td class="num in">${money(c.fund_in)}</td>
        <td class="num">${money(c.other_in)}</td><td class="num out">${money(c.employee_adv)}</td><td class="num out">${money(c.other_out)}</td><td class="num">${money(c.returned)}</td>
        <td class="num"><b>${money(c.closing)}</b></td><td class="num">${money(c.at_day)}</td></tr>`)}
      ${funds.length ? '' : html`<tr><td colspan="10" class="muted" style="text-align:center">Chưa có phát sinh quỹ tiền mặt trong kỳ</td></tr>`}</tbody><tfoot><tr><td colspan="2">Tổng quỹ tiền mặt (${d.cash_funds.length} quỹ)</td>${['opening', 'fund_in', 'other_in', 'employee_adv', 'other_out', 'returned', 'closing', 'at_day'].map((x) => html`<td class="num">${money(d.cash_funds.reduce((a, c) => a + (c[x] || 0), 0))}</td>`)}</tr></tfoot></table></div></div>

    <div class="grid g2 mt">
      <div class="card"><div class="card-h"><h3>Khoản vay</h3></div>
        ${d.loans.length ? html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Số HĐ</th><th>Bên cho vay</th><th>Công ty</th><th class="num">Dư nợ</th><th>Đáo hạn</th><th>Tình trạng</th></tr></thead>
          <tbody>${d.loans.map((l) => html`<tr><td><b>${l.contract_no}</b></td><td>${l.lender || ''}</td><td>${l.company}</td><td class="num">${money(l.outstanding)}</td><td>${date(l.maturity)}</td>
          <td><span class="badge ${l.state === 'QUÁ HẠN' ? 'st-cancelled' : l.state.startsWith('Đến hạn') ? 'st-submitted' : l.outstanding > 0 ? 'st-open' : 'st-posted'}">${l.state}</span></td></tr>`)}</tbody></table></div>` : empty('Chưa có khoản vay')}</div>
      <div class="card"><div class="card-h"><h3>Lương tháng ${monthLabel(d.month)}</h3></div>
        ${d.payroll.length ? html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Công ty</th><th class="num">Số NV</th><th class="num">Tổng thu nhập</th><th class="num">Thực lĩnh</th><th class="num">Đã chi</th><th class="num">Chờ duyệt</th></tr></thead>
          <tbody>${d.payroll.map((p) => html`<tr><td><b>${p.company}</b></td><td class="num">${p.employees}</td><td class="num">${money(p.gross)}</td><td class="num">${money(p.net)}</td><td class="num in">${money(p.paid)}</td><td class="num">${money(p.pending)}</td></tr>`)}</tbody></table></div>` : empty('Chưa có bảng lương trong tháng')}</div>
    </div>
    <div class="grid g2 mt">
      <div class="card"><div class="card-h"><h3>Thanh toán đối tác</h3><span class="muted small">Top 10</span></div>
        ${d.partners.length ? html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Đối tác</th><th class="num">Đã trả trong tháng</th><th class="num">Lũy kế</th><th class="num">Chờ duyệt</th></tr></thead>
          <tbody>${d.partners.map((p) => html`<tr><td><b>${p.partner}</b></td><td class="num">${money(p.paid_month)}</td><td class="num">${money(p.paid_total)}</td><td class="num">${money(p.pending)}</td></tr>`)}</tbody></table></div>` : empty('Chưa có thanh toán đối tác')}</div>
      <div class="card"><div class="card-h"><h3>Điều chuyển nội bộ giữa các công ty</h3></div>
        ${d.intercompany.length ? html`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Công ty</th><th class="num">Chuyển đi (tháng)</th><th class="num">Nhận về (tháng)</th><th class="num">Số dư lũy kế</th></tr></thead>
          <tbody>${d.intercompany.map((p) => html`<tr><td><b>${p.company}</b></td><td class="num out">${money(p.sent_month)}</td><td class="num in">${money(p.recv_month)}</td><td class="num">${money(p.balance)}</td></tr>`)}</tbody></table></div>` : empty('Chưa có điều chuyển nội bộ')}</div>
    </div>`);
}

export { PALETTE };
