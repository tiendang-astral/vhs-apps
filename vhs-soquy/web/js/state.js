// Trạng thái phiên làm việc + danh mục dùng chung (nạp 1 lần, làm mới khi có thay đổi).
import { api } from './core.js';

export const state = { user: null, meta: null, options: null };

export async function loadSession() {
  const [user, meta, options] = await Promise.all([api('/me'), api('/meta'), api('/options')]);
  Object.assign(state, { user, meta, options });
  return state;
}
export async function refreshOptions() { state.options = await api('/options'); return state.options; }
export async function refreshMe() { state.user = await api('/me'); return state.user; }

export const isAdmin = () => state.user?.role === 'admin';
export const moduleMeta = (key) => state.meta.modules.find((m) => m.key === key);
export const label = (v) => state.meta?.labels?.[v] ?? v;
export const myCompanies = () => state.options.companies.filter((c) => state.user.company_ids.includes(c.id));
export const companyCode = (id) => state.options.companies.find((c) => c.id === id)?.code || '';
export const byId = (list, id) => state.options[list]?.find((x) => x.id === id);

/** Danh sách lựa chọn cho trường của chứng từ (theo meta field). */
export function fieldOptions(f) {
  const o = state.options, mine = new Set(state.user.company_ids);
  switch (f.type) {
    case 'account': {
      const list = o.accounts.filter((a) => a.status === 'active' && (f.source === 'any' || mine.has(a.company_id)));
      return list.map((a) => ({ value: a.id, label: `${a.code}${a.kind === 'cash' ? ' · Tiền mặt' : ''}`, group: a.company_code }));
    }
    case 'company': return myCompanies().filter((c) => c.status === 'active').map((c) => ({ value: c.id, label: `${c.code} – ${c.name}` }));
    case 'category': return o.categories.map((c) => ({ value: c.id, label: c.name, group: label(c.nature) }));
    case 'select': return (f.options || []).map((v) => ({ value: v, label: label(v) }));
    case 'ref': return (o[f.source] || []).map((r) => ({ value: r.id, label: r.code ? `${r.code} – ${r.name}` : r.name }));
    default: return [];
  }
}
export function partnerNames(f) {
  return state.options.partners.filter((p) => f.source !== 'employee' || p.type === 'employee').map((p) => p.name);
}
