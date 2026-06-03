import hmac
import hashlib
import time
import secrets
from fastapi import Request, HTTPException, status

SECRET_KEY = "secure-random-key-lambda-env-handler"

def create_cookie(username: str) -> str:
    timestamp = str(int(time.time()))
    message = f"{username}:{timestamp}"
    signature = hmac.new(SECRET_KEY.encode(), message.encode(), hashlib.sha256).hexdigest()
    return f"{message}:{signature}"

def verify_cookie(cookie: str):
    if not cookie:
        return None
    try:
        parts = cookie.split(":")
        if len(parts) != 3:
            return None
        username, timestamp, signature = parts
        expected_signature = hmac.new(SECRET_KEY.encode(), f"{username}:{timestamp}".encode(), hashlib.sha256).hexdigest()
        if not secrets.compare_digest(signature, expected_signature):
            return None
        if int(time.time()) - int(timestamp) > 86400: # 24 hours expiry
            return None
        return username
    except Exception:
        return None

def get_current_username(request: Request):
    cookie = request.cookies.get("session_token")
    username = verify_cookie(cookie)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return username
