"""Cấu hình đọc từ biến môi trường (xem .env.example)."""
import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings:
    APP_NAME: str = os.getenv('APP_NAME', 'QUẢN TRỊ TÀI CHÍNH TIMORI GROUP')
    # postgresql://user:pass@host:5432/db  hoặc  sqlite:///data/soquy.db (chạy thử)
    DATABASE_URL: str = os.getenv('DATABASE_URL', f'sqlite:///{BASE_DIR / "data" / "soquy.db"}')
    SECRET_KEY: str = os.getenv('SECRET_KEY') or ''
    TOKEN_HOURS: int = int(os.getenv('TOKEN_HOURS', '12'))
    ADMIN_USERNAME: str = os.getenv('ADMIN_USERNAME', 'admin')
    ADMIN_PASSWORD: str = os.getenv('ADMIN_PASSWORD', 'Admin@123')
    ADMIN_FULLNAME: str = os.getenv('ADMIN_FULLNAME', 'Admin tập đoàn')
    SEED_LEGACY: bool = os.getenv('SEED_LEGACY', '1') == '1'   # nạp dữ liệu sổ quỹ cũ khi DB trống
    DB_POOL_SIZE: int = int(os.getenv('DB_POOL_SIZE', '10'))
    HUB_URL: str = os.getenv('HUB_URL', '')   # trống = ẩn nút về hub
    WEB_DIR: Path = BASE_DIR / 'web'


settings = Settings()

if not settings.SECRET_KEY:     # chưa cấu hình → tự sinh 1 lần và lưu lại (data/.secret_key)
    _f = BASE_DIR / 'data' / '.secret_key'
    _f.parent.mkdir(parents=True, exist_ok=True)
    if not _f.exists():
        _f.write_text(secrets.token_urlsafe(48))
    settings.SECRET_KEY = _f.read_text().strip()
