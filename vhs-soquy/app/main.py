"""Điểm khởi động ứng dụng:  uvicorn app.main:app --host 0.0.0.0 --port 8000"""
import contextlib
import html
import logging
import traceback

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.responses import HTMLResponse, JSONResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from .api.routes import ROUTES
from .config import settings
from .db import init_schema
from .http import ApiError
from .seed import seed

log = logging.getLogger('soquy')


async def api_error(request, exc: ApiError):
    return JSONResponse({'error': exc.message, 'errors': exc.errors}, status_code=exc.status)


async def server_error(request, exc: Exception):
    log.error('Lỗi máy chủ: %s\n%s', exc, traceback.format_exc())
    return JSONResponse({'error': 'Lỗi hệ thống, vui lòng thử lại hoặc báo quản trị'}, status_code=500)


class NoCacheStatic(StaticFiles):
    """Trình duyệt luôn kiểm tra lại (ETag → 304) để nhận bản mới ngay sau khi cập nhật."""

    def file_response(self, *args, **kwargs):
        resp = super().file_response(*args, **kwargs)
        resp.headers['Cache-Control'] = 'no-cache'
        return resp


async def spa(request):
    page = (settings.WEB_DIR / 'index.html').read_text(encoding='utf-8')
    return HTMLResponse(page.replace('__HUB_URL__', html.escape(settings.HUB_URL)))


def list_routes(request):
    return JSONResponse([{'path': r.path, 'methods': sorted(r.methods or [])} for r in ROUTES])


def startup():
    init_schema()
    seed.run()


@contextlib.asynccontextmanager
async def lifespan(app):
    startup()
    yield


app = Starlette(
    routes=ROUTES + [Route('/api/routes', list_routes),
                     Mount('/static', NoCacheStatic(directory=settings.WEB_DIR), name='static'),
                     Route('/', spa)],
    exception_handlers={ApiError: api_error, Exception: server_error},
    middleware=[Middleware(GZipMiddleware, minimum_size=1000)],
    lifespan=lifespan,
)
