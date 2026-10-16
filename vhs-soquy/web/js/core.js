// Tiện ích dùng chung: gọi API, định dạng, HTML an toàn, icon, toast, modal, drawer.

// ---------------------------------------------------------------- API
const TOKEN_KEY = 'soquy.token';
export const auth = {
  get token() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set token(v) { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch { /* bỏ qua */ } },
};

export class ApiError extends Error {
  constructor(status, message, errors) { super(message); this.status = status; this.errors = errors || {}; }
}

export async function api(path, { method = 'GET', body, query } = {}) {
  let url = '/api' + path;
  if (query) {
    const q = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v != null && v !== false));
    if ([...q].length) url += '?' + q;
  }
  const headers = { 'Content-Type': 'application/json' };
  if (auth.token) headers.Authorization = 'Bearer ' + auth.token;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* không phải JSON */ }
  if (res.status === 401 && path !== '/auth/login') { auth.token = null; location.hash = '#/login'; }
  if (!res.ok) throw new ApiError(res.status, data?.error || 'Lỗi kết nối máy chủ', data?.errors);
  return data;
}

/** Tải file nhị phân từ API (kèm token) và lưu về máy. */
export async function apiDownload(path, filename) {
  const res = await fetch('/api' + path, { headers: auth.token ? { Authorization: 'Bearer ' + auth.token } : {} });
  if (!res.ok) { let m = 'Không tải được file'; try { m = (await res.json()).error || m; } catch { /* bỏ qua */ } throw new ApiError(res.status, m); }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await res.blob()); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/** Đọc file người dùng chọn thành base64. */
export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',').pop());
  r.onerror = () => reject(new Error('Không đọc được file'));
  r.readAsDataURL(file);
});

// ---------------------------------------------------------------- HTML
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
const part = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(part).join('') : v === false || v == null ? '' : esc(v));
/** Tagged template: tự escape giá trị chèn vào (chống XSS). Dùng raw() cho HTML tin cậy. */
export const html = (strings, ...vals) => raw(strings.reduce((a, s, i) => a + s + (i < vals.length ? part(vals[i]) : ''), ''));
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// ---------------------------------------------------------------- định dạng
const nf = new Intl.NumberFormat('vi-VN');
export const money = (v) => (v == null || v === '' ? '' : nf.format(Math.round(v)));
export const moneyShort = (v) => {
  const a = Math.abs(v || 0), s = v < 0 ? '-' : '';
  if (a >= 1e9) return s + (a / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ';
  if (a >= 1e6) return s + (a / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';
  if (a >= 1e3) return s + Math.round(a / 1e3) + 'k';
  return s + a;
};
export const date = (v) => (v ? v.slice(0, 10).split('-').reverse().join('/') : '');
export const dateTime = (v) => (v ? `${date(v)} ${v.slice(11, 16)}` : '');
export const monthLabel = (v) => (v ? `${v.slice(5, 7)}/${v.slice(0, 4)}` : '');
export const pct = (v) => (v == null ? '' : (v * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + '%');
export const todayStr = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
export const parseMoney = (s) => { const n = String(s ?? '').replace(/[^\d-]/g, ''); return n === '' || n === '-' ? null : parseInt(n, 10); };
export const initials = (name) => (name || '?').trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();
export const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------------------------------------------------------------- icon (SVG nội tuyến, không phụ thuộc CDN)
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  swap: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
  partner: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  payroll: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
  pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.9-1"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>', ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  flag: '<path d="M4 22V4a1 1 0 0 1 1-1h12l-2 4 2 4H5"/>', download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>', logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M17 6l3 3M15 8l2 2"/>',
  up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  bank: '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-7 10 7z"/>', alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  trend: '<path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>', printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  refresh: '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  excel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m8 8 8 8M16 8l-8 8"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
};
export const icon = (name, cls = '') => raw(`<svg class="i ${cls}" viewBox="0 0 24 24">${P[name] || P.file}</svg>`);

// ---------------------------------------------------------------- toast
export function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = String(html`${icon(type === 'err' ? 'alert' : 'check')}<span>${msg}</span>`);
  $('#toasts').append(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = 0; setTimeout(() => el.remove(), 300); }, type === 'err' ? 5000 : 2800);
}
export const showError = (e) => toast(e?.message || String(e), 'err');

// ---------------------------------------------------------------- modal / drawer
/** Mở hộp thoại. Trả về {el, close}. onClose được gọi khi đóng. */
export function overlay(content, { kind = 'modal', size = '', onClose } = {}) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="${kind} ${size}" role="dialog">${content}</div>`;
  document.body.append(ov);
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape' && document.body.lastElementChild === ov) close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  ov.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  const first = ov.querySelector('input:not([type=hidden]):not([readonly]), select, textarea');
  if (first && kind === 'modal') setTimeout(() => first.focus(), 30);
  return { el: ov.firstElementChild, close };
}

export function confirmBox({ title, message, ok = 'Đồng ý', tone = 'primary', input = null }) {
  return new Promise((resolve) => {
    let done = false;
    const { el, close } = overlay(String(html`
      <div class="modal-h"><h3>${title}</h3></div>
      <div class="modal-b"><p style="margin:0 0 4px;color:var(--text-2)">${message}</p>
        ${input ? html`<div class="fld mt"><label>${input}</label><textarea class="input" id="cf-note"></textarea></div>` : ''}</div>
      <div class="modal-f"><button class="btn" data-close>Hủy</button><button class="btn ${tone}" id="cf-ok">${ok}</button></div>`),
    { size: 'sm', onClose: () => { if (!done) resolve(null); } });
    $('#cf-ok', el).onclick = () => {
      const note = input ? $('#cf-note', el).value.trim() : '';
      done = true; close(); resolve({ note });
    };
    if (input) setTimeout(() => $('#cf-note', el).focus(), 30);
  });
}

/** Nút đang xử lý: khóa nút trong lúc chờ promise. */
export async function busy(btn, fn) {
  if (!btn) return fn();
  const old = btn.innerHTML; btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;margin:0;border-width:2px"></span>';
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
}

export const empty = (msg = 'Chưa có dữ liệu', ic = 'file') => html`<div class="empty">${icon(ic)}<div>${msg}</div></div>`;

export function downloadCSV(filename, headers, rows) {
  const q = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = '﻿' + [headers, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
