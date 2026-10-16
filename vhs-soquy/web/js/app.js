// Khung ứng dụng: đăng nhập, thanh điều hướng theo vai trò, định tuyến (#/...).
export const APP_NAME = 'QUẢN TRỊ TÀI CHÍNH TIMORI GROUP';
import { $, api, auth, busy, html, icon, initials, overlay, showError, toast } from './core.js';
import { loadSession, refreshMe, state } from './state.js';

const root = document.getElementById('root');
const appName = () => state.meta?.app_name || APP_NAME;   // đổi tên qua biến môi trường APP_NAME

// key route → [tiêu đề nhóm, file trang, hàm render]
const PAGES = {
  dashboard: () => import('./pages/dashboard.js').then((m) => m.renderDashboard),
  docs: () => import('./pages/docs.js').then((m) => m.renderModule),
  inbox: () => import('./pages/docs.js').then((m) => m.renderInbox),
  'ledger-day': () => import('./pages/reports.js').then((m) => m.renderLedger('day')),
  'ledger-month': () => import('./pages/reports.js').then((m) => m.renderLedger('month')),
  'summary-day': () => import('./pages/reports.js').then((m) => m.renderSummary('day')),
  'summary-month': () => import('./pages/reports.js').then((m) => m.renderSummary('month')),
  control: () => import('./pages/reports.js').then((m) => m.renderControl),
  master: () => import('./pages/master.js').then((m) => m.renderMaster),
  users: () => import('./pages/users.js').then((m) => m.renderUsers),
  guide: () => import('./pages/guide.js').then((m) => m.renderGuide),
};
const NAV_ICON = {
  dashboard: 'home', inbox: 'inbox', 'ledger-day': 'list', 'ledger-month': 'calendar', 'summary-day': 'chart',
  'summary-month': 'pie', control: 'shield', master: 'db', users: 'users', guide: 'book',
  'docs/cashbook': 'swap', 'docs/partner_payment': 'partner', 'docs/payroll': 'payroll', 'docs/cash_fund': 'cash',
};

export function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs || '')) };
}
/** Cập nhật query trên URL mà không render lại trang. */
export function setQuery(q) {
  const { parts } = parseHash();
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== '' && v != null && v !== false)).toString();
  history.replaceState(null, '', '#/' + parts.join('/') + (s ? '?' + s : ''));
}

// ---------------------------------------------------------------- đăng nhập
function renderLogin() {
  root.innerHTML = String(html`
  <div class="login">
    <div class="art">
      <div class="brand" style="padding:0"><div class="logo tmr">T</div><div><b>TIMORI GROUP</b><span>Hệ thống ERP tập đoàn</span></div></div>
      <div>
        <h1>${APP_NAME}</h1>
        <p>Lập chứng từ thu chi, duyệt nhiều cấp (Kế toán trưởng → Giám đốc công ty trụ cột → Admin tập đoàn), tự động ghi sổ và cập nhật báo cáo theo thời gian thực.</p>
        <div style="margin-top:22px">
          <span class="pill">${icon('check')} Duyệt 3 cấp</span><span class="pill">${icon('check')} Nhập lương từ Excel</span><span class="pill">${icon('check')} Phân quyền theo công ty</span>
          <span class="pill">${icon('check')} Dashboard điều hành</span><span class="pill">${icon('check')} Kiểm soát hạch toán</span>
        </div>
      </div>
      <div class="small" style="color:#6d7d9c">GROUP TPE · GROUP VHS · GROUP ASTRAL-X</div>
    </div>
    <div class="box">
      <form id="login-form" autocomplete="on">
        <h2>Đăng nhập</h2>
        <p class="muted" style="margin:0">Sử dụng tài khoản được Admin tập đoàn cấp.</p>
        <div class="fld"><label>Tên đăng nhập</label><input class="input" name="username" autocomplete="username" required></div>
        <div class="fld"><label>Mật khẩu</label><input class="input" name="password" type="password" autocomplete="current-password" required></div>
        <div class="fld err" id="login-err" style="color:var(--out);min-height:18px"></div>
        <button class="btn primary" type="submit">Đăng nhập</button>
      </form>
    </div>
  </div>`);
  const f = $('#login-form');
  setTimeout(() => f.username.focus());
  f.onsubmit = (e) => {
    e.preventDefault();
    busy(f.querySelector('button'), async () => {
      try {
        const r = await api('/auth/login', { method: 'POST', body: { username: f.username.value, password: f.password.value } });
        auth.token = r.token;
        await loadSession();
        location.hash = '#/' + (state.user.nav[0]?.key || 'guide');
        renderShell(); route();
      } catch (err) { $('#login-err').textContent = err.message; }
    });
  };
}

// ---------------------------------------------------------------- khung
function navHTML() {
  const groups = [];
  for (const it of state.user.nav) {
    let g = groups.find((x) => x.name === it.group);
    if (!g) groups.push(g = { name: it.group, items: [] });
    g.items.push(it);
  }
  return groups.map((g) => html`<h6>${g.name}</h6>${g.items.map((it) => html`
    <a href="#/${it.key}" data-key="${it.key}">${icon(NAV_ICON[it.key] || 'file')}<span>${it.title}</span>
      ${it.key === 'inbox' && state.user.inbox ? html`<span class="badge plain">${state.user.inbox}</span>` : ''}</a>`)}`);
}

function renderShell() {
  const u = state.user;
  root.innerHTML = String(html`
  <div class="app" id="app">
    <aside class="side">
      <div class="brand"><div class="logo tmr">T</div><div><b class="app-name">${appName()}</b><span>ERP · Quản lý dòng tiền</span></div></div>
      <nav class="nav" id="nav">${navHTML()}</nav>
      <div class="side-foot">Phạm vi: ${u.role === 'admin' ? 'Toàn tập đoàn' : `${u.company_ids.length} công ty`}</div>
    </aside>
    <div class="main">
      <header class="top">
        <button class="btn ghost icon burger" id="burger">${icon('menu')}</button>
        <div><h1 id="page-title"></h1><div class="crumb" id="page-crumb"></div></div>
        <div class="sp"></div>
        <div class="user-chip" id="user-chip">
          <div class="avatar">${initials(u.full_name)}</div>
          <div class="who"><b>${u.full_name}</b><small>${u.role_label}</small></div>${icon('down')}
        </div>
      </header>
      <main class="page" id="page"></main>
    </div>
  </div>`);
  $('#burger').onclick = () => $('#app').classList.toggle('nav-open');
  $('#nav').onclick = () => $('#app').classList.remove('nav-open');
  $('#user-chip').onclick = (e) => {
    e.stopPropagation();
    const old = $('.menu'); if (old) return old.remove();
    const m = document.createElement('div'); m.className = 'menu';
    m.innerHTML = String(html`<div style="padding:8px 10px 6px" class="small muted">@${u.username}</div>
      <button data-m="pw">${icon('key')} Đổi mật khẩu</button><button data-m="out">${icon('logout')} Đăng xuất</button>`);
    $('#user-chip').append(m);
    m.onclick = (ev) => {
      const k = ev.target.closest('button')?.dataset.m;
      if (k === 'out') { auth.token = null; state.user = null; location.hash = '#/login'; renderLogin(); }
      if (k === 'pw') changePassword();
    };
    document.addEventListener('click', () => m.remove(), { once: true });
  };
}

function changePassword() {
  const { el, close } = overlay(String(html`
    <div class="modal-h"><h3>Đổi mật khẩu</h3><div class="sp"></div><button class="btn ghost icon" data-close>${icon('x')}</button></div>
    <form class="modal-b" id="pw-form" style="display:grid;gap:14px">
      <div class="fld"><label>Mật khẩu hiện tại</label><input class="input" type="password" name="old" required></div>
      <div class="fld"><label>Mật khẩu mới (tối thiểu 6 ký tự)</label><input class="input" type="password" name="new1" required minlength="6"></div>
      <div class="fld"><label>Nhập lại mật khẩu mới</label><input class="input" type="password" name="new2" required></div>
    </form>
    <div class="modal-f"><button class="btn" data-close>Hủy</button><button class="btn primary" id="pw-save">Lưu</button></div>`), { size: 'sm' });
  $('#pw-save', el).onclick = (e) => {
    const f = $('#pw-form', el);
    if (f.new1.value !== f.new2.value) return showError('Mật khẩu nhập lại không khớp');
    busy(e.currentTarget, async () => {
      try {
        await api('/me/password', { method: 'POST', body: { old_password: f.old.value, new_password: f.new1.value } });
        toast('Đã đổi mật khẩu'); close();
      } catch (err) { showError(err); }
    });
  };
}

export function setTitle(title, crumb = '') {
  $('#page-title').textContent = title; $('#page-crumb').textContent = crumb;
  document.title = `${title} · ${appName()}`;
}

/** Cập nhật số chứng từ chờ duyệt trên menu. */
export async function refreshBadge() {
  try { await refreshMe(); $('#nav').innerHTML = String(navHTML()); markActive(); } catch { /* bỏ qua */ }
}
function markActive() {
  const { parts } = parseHash(), key = parts[0] === 'docs' ? parts.slice(0, 2).join('/') : parts[0];
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.key === key));
}

let routeSeq = 0;
async function route() {
  const { parts, query } = parseHash();
  if (!auth.token) return renderLogin();
  if (!state.user) {
    try { await loadSession(); } catch { return renderLogin(); }
    renderShell();
  }
  if (!$('#page')) renderShell();
  const key = parts[0] || state.user.nav[0]?.key;
  const allowed = state.user.nav.some((n) => n.key === (key === 'docs' ? `docs/${parts[1]}` : key));
  if (!PAGES[key] || !allowed) { location.hash = '#/' + state.user.nav[0].key; return; }
  markActive();
  const page = $('#page'), seq = ++routeSeq;
  page.innerHTML = '<div class="spinner"></div>';
  try {
    const render = await PAGES[key]();
    if (seq !== routeSeq) return;
    await render(page, parts.slice(1), query);
  } catch (e) {
    if (seq !== routeSeq) return;
    page.innerHTML = String(html`<div class="note err">${icon('alert')} ${e.message}</div>`);
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
