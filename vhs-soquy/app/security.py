"""Mật khẩu (PBKDF2-SHA256, thư viện chuẩn) và token đăng nhập (JWT HS256)."""
import hashlib
import hmac
import os
import time

import jwt

from .config import settings

_ITER = 310_000


def hash_password(pw: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac('sha256', pw.encode(), salt, _ITER)
    return f'pbkdf2${_ITER}${salt.hex()}${dk.hex()}'


def verify_password(pw: str, stored: str) -> bool:
    try:
        _, it, salt, h = stored.split('$')
        dk = hashlib.pbkdf2_hmac('sha256', pw.encode(), bytes.fromhex(salt), int(it))
        return hmac.compare_digest(dk.hex(), h)
    except Exception:
        return False


def make_token(user_id: int) -> str:
    now = int(time.time())
    return jwt.encode({'sub': str(user_id), 'iat': now, 'exp': now + settings.TOKEN_HOURS * 3600},
                      settings.SECRET_KEY, algorithm='HS256')


def read_token(token: str):
    try:
        return int(jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])['sub'])
    except Exception:
        return None
