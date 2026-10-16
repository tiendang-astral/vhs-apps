// Biểu đồ SVG thuần (không thư viện ngoài): cột + đường, vùng, donut, thanh ngang.
import { esc, html, money, moneyShort, raw } from './core.js';

export const PALETTE = ['#1f4fd8', '#0ea5a4', '#f59e0b', '#7c4dff', '#e0452f', '#10b981', '#ec4899', '#64748b', '#0284c7', '#a16207', '#84cc16', '#9333ea'];

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v)), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

let uid = 0;
/** Biểu đồ cột nhóm + đường (trục phải tuỳ chọn).
 * series: [{name, color, values, type: 'bar'|'line'|'area', axis: 'left'|'right'}] */
export function combo({ labels, series, height = 260, width = 720, fmtX = (x) => x }) {
  const id = 'ch' + (++uid);
  const W = width, H = height, pl = 58, pr = series.some((s) => s.axis === 'right') ? 62 : 14, pt = 14, pb = 28;
  const iw = W - pl - pr, ih = H - pt - pb, n = labels.length || 1, bw = iw / n;
  const axisMax = (ax) => {
    const vals = series.filter((s) => (s.axis || 'left') === ax).flatMap((s) => s.values.map((v) => v || 0));
    const mx = Math.max(0, ...vals), mn = Math.min(0, ...vals);
    return [mn < 0 ? -niceMax(-mn) : 0, niceMax(mx)];
  };
  const [lmin, lmax] = axisMax('left'), [rmin, rmax] = axisMax('right');
  const y = (v, ax = 'left') => { const [a, b] = ax === 'right' ? [rmin, rmax] : [lmin, lmax]; return pt + ih - ((v - a) / (b - a || 1)) * ih; };
  const bars = series.filter((s) => (s.type || 'bar') === 'bar');
  const gw = Math.min(bw * 0.72, 46), each = gw / (bars.length || 1);
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = lmin + ((lmax - lmin) * i) / 4, yy = y(v);
    g += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="#eef1f6"/>`;
    g += `<text x="${pl - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#8592a6">${moneyShort(v)}</text>`;
    if (pr > 20) { const rv = rmin + ((rmax - rmin) * i) / 4; g += `<text x="${W - pr + 8}" y="${yy + 4}" font-size="11" fill="#8592a6">${moneyShort(rv)}</text>`; }
  }
  const step = Math.ceil(n / 12);
  labels.forEach((l, i) => { if (i % step === 0) g += `<text x="${pl + bw * i + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#8592a6">${esc(fmtX(l))}</text>`; });
  bars.forEach((s, si) => s.values.forEach((v, i) => {
    const x = pl + bw * i + (bw - gw) / 2 + each * si, y0 = y(0), y1 = y(v || 0);
    g += `<rect x="${x + 1}" y="${Math.min(y0, y1)}" width="${Math.max(each - 2, 1)}" height="${Math.max(Math.abs(y0 - y1), v ? 1 : 0)}" rx="3" fill="${s.color}"/>`;
  }));
  series.filter((s) => s.type === 'line' || s.type === 'area').forEach((s) => {
    const pts = s.values.map((v, i) => [pl + bw * i + bw / 2, y(v || 0, s.axis)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    if (s.type === 'area') {
      g += `<defs><linearGradient id="${id}g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".22"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>`;
      g += `<path d="${d}L${pts.at(-1)[0]} ${pt + ih}L${pts[0][0]} ${pt + ih}Z" fill="url(#${id}g)"/>`;
    }
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"/>`;
    if (n <= 31) pts.forEach((p) => { g += `<circle cx="${p[0]}" cy="${p[1]}" r="2.8" fill="#fff" stroke="${s.color}" stroke-width="2"/>`; });
  });
  labels.forEach((l, i) => { g += `<rect class="hit" data-i="${i}" x="${pl + bw * i}" y="${pt}" width="${bw}" height="${ih}" fill="transparent"/>`; });
  const tipData = labels.map((l, i) => `<b>${esc(fmtX(l))}</b>` + series.map((s) => `<div><span style="color:${s.color}">●</span> ${esc(s.name)}: <b>${money(s.values[i])}</b></div>`).join(''));
  setTimeout(() => bindTip(id, tipData));
  const legend = series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
  return raw(`<div class="chart" id="${id}"><svg viewBox="0 0 ${W} ${H}">${g}</svg><div class="tip"></div></div><div class="legend" style="margin-top:8px">${legend}</div>`);
}

function bindTip(id, data) {
  const el = document.getElementById(id); if (!el) return;
  const tip = el.querySelector('.tip'), svg = el.querySelector('svg');
  el.addEventListener('mousemove', (e) => {
    const r = e.target.closest('.hit'); if (!r) { tip.style.display = 'none'; return; }
    tip.innerHTML = data[+r.dataset.i]; tip.style.display = 'block';
    const box = el.getBoundingClientRect();
    let x = e.clientX - box.left; x = Math.max(80, Math.min(box.width - 80, x));
    tip.style.left = x + 'px'; tip.style.top = (e.clientY - box.top - 8) + 'px';
    svg.querySelectorAll('.hit').forEach((h) => h.setAttribute('fill', h === r ? 'rgba(31,79,216,.05)' : 'transparent'));
  });
  el.addEventListener('mouseleave', () => { tip.style.display = 'none'; svg.querySelectorAll('.hit').forEach((h) => h.setAttribute('fill', 'transparent')); });
}

/** Donut: items [{label, value}] */
export function donut(items, { size = 168, center = '', sub = '' } = {}) {
  const data = items.filter((d) => d.value > 0);
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = 62, c = 2 * Math.PI * r;
  let off = 0, arcs = '';
  data.forEach((d, i) => {
    const len = (d.value / (total || 1)) * c;
    arcs += `<circle r="${r}" cx="80" cy="80" fill="none" stroke="${d.color || PALETTE[i % PALETTE.length]}" stroke-width="20" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"><title>${esc(d.label)}: ${money(d.value)}</title></circle>`;
    off += len;
  });
  if (!data.length) arcs = `<circle r="${r}" cx="80" cy="80" fill="none" stroke="#eef1f6" stroke-width="20"/>`;
  const leg = data.map((d, i) => `<div><span><i style="background:${d.color || PALETTE[i % PALETTE.length]}"></i>${esc(d.label)}</span><b class="num">${((d.value / (total || 1)) * 100).toFixed(1)}%</b></div>`).join('');
  return raw(`<div class="donut-wrap"><svg viewBox="0 0 160 160" style="width:${size}px;height:${size}px;flex:none">${arcs}
    <text x="80" y="78" text-anchor="middle" font-size="17" font-weight="700" fill="#0f1b2d">${esc(center || moneyShort(total))}</text>
    <text x="80" y="96" text-anchor="middle" font-size="10.5" fill="#8592a6">${esc(sub)}</text></svg>
    <div class="legend">${leg || '<span class="muted">Không có số liệu</span>'}</div></div>`);
}

/** Thanh ngang: items [{label, value, sub}] */
export function hbars(items, { color } = {}) {
  const mx = Math.max(1, ...items.map((d) => Math.abs(d.value)));
  return html`<div class="bars-h">${items.map((d) => html`<div class="bar-row">
    <span title="${d.title || d.label}" style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.label}</span>
    <div class="track"><div class="fill" style="width:${(Math.abs(d.value) / mx) * 100}%;${d.value < 0 ? 'background:#e0452f' : color ? `background:${color}` : ''}"></div></div>
    <span class="num">${money(d.value)}</span></div>`)}</div>`;
}
