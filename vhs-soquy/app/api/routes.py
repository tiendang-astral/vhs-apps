"""REST API (JSON). Tài liệu nhanh: GET /api/routes. Mọi API (trừ đăng nhập) cần header Authorization: Bearer <token>.
Các công cụ khác (ERP, BI, app di động…) kết nối qua các endpoint này."""
from urllib.parse import quote

from starlette.responses import Response
from starlette.routing import Route

from ..db import get_db
from ..http import ApiError, body, current_user, ok, q_int, q_str, today
from ..modules import REGISTRY, get_module
from ..config import settings
from ..permissions import (PERMISSIONS, ROLES, can_create, can_l1, can_view_dashboard, can_view_module, can_view_summary,
                           is_admin, is_director, require)
from ..security import make_token, verify_password
from ..services import guide as guide_svc
from ..services import importer
from ..services import masterdata as md
from ..services import reports as rp
from ..services import users as us
from ..services import workflow as wf


def public_user(u):
    return {k: (sorted(v) if isinstance(v, set) else v) for k, v in u.items()}


def nav_for(u):
    items = []
    if can_view_dashboard(u):
        items.append({'key': 'dashboard', 'title': 'Dashboard', 'group': 'Tổng quan'})
    for m in REGISTRY.values():
        if can_view_module(u, m):
            items.append({'key': f'docs/{m.key}', 'title': m.title, 'group': 'Nghiệp vụ', 'icon': m.icon,
                          'can_create': can_create(u, m)})
    if is_admin(u) or is_director(u) or any(can_l1(u, m) for m in REGISTRY.values()):
        items.append({'key': 'inbox', 'title': 'Chứng từ chờ duyệt', 'group': 'Nghiệp vụ'})
    items += [{'key': 'ledger-day', 'title': 'Chi tiết theo ngày', 'group': 'Báo cáo'},
              {'key': 'ledger-month', 'title': 'Chi tiết theo tháng', 'group': 'Báo cáo'}]
    if can_view_summary(u):
        items += [{'key': 'summary-day', 'title': 'Tổng hợp theo ngày', 'group': 'Báo cáo'},
                  {'key': 'summary-month', 'title': 'Tổng hợp theo tháng', 'group': 'Báo cáo'}]
    if is_admin(u):
        items.append({'key': 'control', 'title': 'Kiểm soát hạch toán', 'group': 'Báo cáo'})
    items.append({'key': 'master', 'title': 'Dữ liệu khai báo', 'group': 'Hệ thống'})
    if is_admin(u):
        items.append({'key': 'users', 'title': 'Tài khoản người dùng', 'group': 'Hệ thống'})
    items.append({'key': 'guide', 'title': 'Hướng dẫn nhập liệu', 'group': 'Hệ thống'})
    return items


# ---------------------------------------------------------------- auth
async def login(request):
    data = await body(request)
    with get_db() as db:
        u = db.one('SELECT id, password_hash, active FROM users WHERE username=?', [(data.get('username') or '').strip().lower()])
    if not u or not u['active'] or not verify_password(data.get('password') or '', u['password_hash']):
        raise ApiError(401, 'Sai tên đăng nhập hoặc mật khẩu')
    return ok({'token': make_token(u['id'])})


def me(request):
    with get_db() as db:
        u = current_user(request, db)
        u['nav'] = nav_for(u)
        u['inbox'] = len(wf.inbox(db, u))
    u['role_label'] = ROLES[u['role']]
    return ok(public_user(u))


async def change_password(request):
    data = await body(request)
    with get_db() as db:
        u = current_user(request, db)
        us.change_password(db, u, data.get('old_password'), data.get('new_password'))
    return ok()


def meta(request):
    u = current_user(request)
    return ok({'app_name': settings.APP_NAME, 'modules': [dict(m.meta(), can_create=can_create(u, m), can_l1=can_l1(u, m))
                           for m in REGISTRY.values() if can_view_module(u, m)],
               'all_modules': [{'key': m.key, 'title': m.title} for m in REGISTRY.values()],
               'master': md.meta(), 'labels': md.LABELS, 'status': wf.STATUS, 'roles': ROLES,
               'permissions': [{'key': k, 'label': v} for k, v in PERMISSIONS]})


def options(request):
    with get_db() as db:
        current_user(request, db)
        return ok(md.options(db))


# ---------------------------------------------------------------- chứng từ
def docs_list(request):
    m = get_module(request.path_params['module'])
    with get_db() as db:
        u = current_user(request, db)
        return ok(wf.list_docs(db, u, m, status=q_str(request, 'status'), company_id=q_int(request, 'company_id'),
                               date_from=q_str(request, 'from'), date_to=q_str(request, 'to'), q=q_str(request, 'q'),
                               mine=q_str(request, 'mine') == '1', reopen=q_str(request, 'reopen') == '1',
                               limit=min(q_int(request, 'limit', 300), 2000), offset=q_int(request, 'offset', 0)))


async def docs_create(request):
    m = get_module(request.path_params['module'])
    data = await body(request)
    with get_db() as db:
        u = current_user(request, db)
        new_id = wf.create(db, u, m, data)
        if data.get('_submit'):
            wf.submit(db, u, m, new_id)
    return ok({'id': new_id}, 201)


def docs_get(request):
    m = get_module(request.path_params['module'])
    with get_db() as db:
        u = current_user(request, db)
        return ok(wf.get_doc(db, u, m, int(request.path_params['id'])))


async def docs_update(request):
    m = get_module(request.path_params['module'])
    data = await body(request)
    with get_db() as db:
        u = current_user(request, db)
        doc_id = int(request.path_params['id'])
        wf.update(db, u, m, doc_id, data)
        if data.get('_submit'):
            wf.submit(db, u, m, doc_id)
    return ok()


def docs_delete(request):
    m = get_module(request.path_params['module'])
    with get_db() as db:
        u = current_user(request, db)
        wf.delete(db, u, m, int(request.path_params['id']))
    return ok()


async def docs_action(request):
    m = get_module(request.path_params['module'])
    data = await body(request)
    with get_db() as db:
        u = current_user(request, db)
        res = wf.run_action(db, u, m, int(request.path_params['id']), request.path_params['action'], data.get('note'))
    return ok({'result': res})


async def docs_bulk(request):
    m = get_module(request.path_params['module'])
    data = await body(request)
    done, failed = 0, []
    for doc_id in data.get('ids') or []:
        try:
            with get_db() as db:      # mỗi chứng từ 1 transaction: lỗi 1 cái không ảnh hưởng cái khác
                u = current_user(request, db)
                wf.run_action(db, u, m, int(doc_id), data.get('action'), data.get('note'))
            done += 1
        except ApiError as e:
            failed.append({'id': doc_id, 'error': e.message})
    return ok({'done': done, 'failed': failed})


def docs_template(request):
    m = get_module(request.path_params['module'])
    with get_db() as db:
        u = current_user(request, db)
        content = importer.template(db, u, m)
    name = f'Bieu_mau_{m.key}.xlsx'
    return Response(content, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    headers={'Content-Disposition': f"attachment; filename={name}; filename*=UTF-8''{quote(name)}"})


async def docs_import(request):
    """{file: base64, filename, dry_run: true|false, submit: true|false}"""
    m = get_module(request.path_params['module'])
    data = await body(request)
    content = importer.decode(data.get('file'))
    with get_db() as db:
        u = current_user(request, db)
        if data.get('dry_run', True):
            return ok(importer.preview(db, u, m, content))
        return ok(importer.commit(db, u, m, content, data.get('filename') or '', bool(data.get('submit'))), 201)


def inbox(request):
    with get_db() as db:
        u = current_user(request, db)
        return ok(wf.inbox(db, u))


# ---------------------------------------------------------------- dữ liệu khai báo
def master_list(request):
    with get_db() as db:
        current_user(request, db)
        return ok(md.list_rows(db, request.path_params['table']))


async def master_create(request):
    data = await body(request)
    with get_db() as db:
        u = current_user(request, db)
        return ok({'id': md.create(db, u, request.path_params['table'], data)}, 201)


async def master_update(request):
    data = await body(request)
    with get_db() as db:
        u = current_user(request, db)
        md.update(db, u, request.path_params['table'], int(request.path_params['id']), data)
    return ok()


def master_delete(request):
    with get_db() as db:
        u = current_user(request, db)
        md.delete(db, u, request.path_params['table'], int(request.path_params['id']))
    return ok()


async def master_lock(request):
    data = await body(request)
    with get_db() as db:
        u = current_user(request, db)
        fn = md.lock if request.path_params['op'] == 'lock' else md.unlock
        return ok({'count': fn(db, u, request.path_params['table'], [int(i) for i in data.get('ids') or []])})


# ---------------------------------------------------------------- báo cáo
def rep_ledger(request):
    with get_db() as db:
        u = current_user(request, db)
        start = q_str(request, 'from', today())
        return ok(rp.ledger(db, u, start, q_str(request, 'to', start), q_int(request, 'company_id'), q_int(request, 'account_id'),
                            q_int(request, 'category_id')))


def rep_summary_day(request):
    with get_db() as db:
        u = current_user(request, db)
        require(can_view_summary(u), 'Chỉ Kế toán trưởng / Giám đốc xem tổng hợp')
        return ok(rp.summary_day(db, u, q_str(request, 'date', today()), q_int(request, 'company_id')))


def rep_summary_month(request):
    with get_db() as db:
        u = current_user(request, db)
        require(can_view_summary(u), 'Chỉ Kế toán trưởng / Giám đốc xem tổng hợp')
        return ok(rp.summary_month(db, u, q_str(request, 'month', today()[:7]), q_int(request, 'company_id')))


def rep_dashboard(request):
    with get_db() as db:
        u = current_user(request, db)
        require(can_view_dashboard(u), 'Dashboard dành cho Admin tập đoàn / GĐ công ty trụ cột')
        # các nhóm trụ cột người dùng được xem (Admin: tất cả; Admin 2: nhóm có công ty được giao)
        groups = [g for g in db.all('SELECT g.id, g.name, c.id AS company_id FROM company_groups g JOIN companies c ON c.group_id=g.id ORDER BY g.id')
                  if g['company_id'] in u['company_ids']]
        group_list = []
        for g in groups:
            if not any(x['id'] == g['id'] for x in group_list):
                group_list.append({'id': g['id'], 'name': g['name']})
        gid = q_int(request, 'group_id')
        view = u
        if gid:
            cos = [g['company_id'] for g in groups if g['id'] == gid]
            require(bool(cos), 'Bạn không được xem nhóm công ty này')
            view = dict(u, company_ids=cos)        # thu hẹp phạm vi báo cáo về 1 nhóm
        data = rp.dashboard(db, view, q_str(request, 'month', today()[:7]), q_str(request, 'date', today()))
        data['group_options'] = group_list
        data['group_id'] = gid
        data['scope_label'] = (next((g['name'] for g in group_list if g['id'] == gid), '') if gid else
                               'Toàn tập đoàn' if is_admin(u) else ' + '.join(g['name'] for g in group_list))
        return ok(data)


def rep_control(request):
    with get_db() as db:
        u = current_user(request, db)
        require(is_admin(u), 'Chỉ Admin tập đoàn')
        return ok(rp.control(db, u))


# ---------------------------------------------------------------- người dùng
def users_list(request):
    with get_db() as db:
        return ok(us.list_users(db, current_user(request, db)))


async def users_create(request):
    data = await body(request)
    with get_db() as db:
        return ok({'id': us.create_user(db, current_user(request, db), data)}, 201)


async def users_update(request):
    data = await body(request)
    with get_db() as db:
        us.update_user(db, current_user(request, db), int(request.path_params['id']), data)
    return ok()


def users_delete(request):
    with get_db() as db:
        return ok({'result': us.delete_user(db, current_user(request, db), int(request.path_params['id']))})


def guide(request):
    current_user(request)
    return ok(guide_svc.guide())


def health(request):
    with get_db() as db:
        db.scalar('SELECT 1')
    return ok({'status': 'ok'})


ROUTES = [
    Route('/api/health', health),
    Route('/api/auth/login', login, methods=['POST']),
    Route('/api/me', me),
    Route('/api/me/password', change_password, methods=['POST']),
    Route('/api/meta', meta),
    Route('/api/options', options),
    Route('/api/inbox', inbox),
    Route('/api/docs/{module}', docs_list),
    Route('/api/docs/{module}', docs_create, methods=['POST']),
    Route('/api/docs/{module}/bulk', docs_bulk, methods=['POST']),
    Route('/api/docs/{module}/template', docs_template),
    Route('/api/docs/{module}/import', docs_import, methods=['POST']),
    Route('/api/docs/{module}/{id:int}', docs_get),
    Route('/api/docs/{module}/{id:int}', docs_update, methods=['PUT']),
    Route('/api/docs/{module}/{id:int}', docs_delete, methods=['DELETE']),
    Route('/api/docs/{module}/{id:int}/{action}', docs_action, methods=['POST']),
    Route('/api/master/{table}', master_list),
    Route('/api/master/{table}', master_create, methods=['POST']),
    Route('/api/master/{table}/{op:str}', master_lock, methods=['POST']),
    Route('/api/master/{table}/{id:int}', master_update, methods=['PUT']),
    Route('/api/master/{table}/{id:int}', master_delete, methods=['DELETE']),
    Route('/api/reports/ledger', rep_ledger),
    Route('/api/reports/summary-day', rep_summary_day),
    Route('/api/reports/summary-month', rep_summary_month),
    Route('/api/reports/dashboard', rep_dashboard),
    Route('/api/reports/control', rep_control),
    Route('/api/users', users_list),
    Route('/api/users', users_create, methods=['POST']),
    Route('/api/users/{id:int}', users_update, methods=['PUT']),
    Route('/api/users/{id:int}', users_delete, methods=['DELETE']),
    Route('/api/guide', guide),
]
