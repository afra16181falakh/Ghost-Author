"""
GitHub OAuth authentication + JWT session tokens + RBAC + API key auth.

Auth flows:
  1. GitHub OAuth: /api/auth/github/login → callback → JWT cookie
  2. JWT Bearer: Authorization: Bearer <token>
  3. API Key: Authorization: Bearer ga_<key>  (for CI pipelines)

RBAC roles: admin > developer > viewer
"""
import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta
from functools import wraps
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.config import get_settings
from api.database import get_db
from api.models import ApiKey, User, UserRole
from api.schemas import TokenOut, UserOut

logger = logging.getLogger("ghost_author")
settings = get_settings()

router = APIRouter(prefix="/api/auth", tags=["auth"])

ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"

API_KEY_PREFIX = "ga_"


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    """Returns user_id or None if invalid."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


# ── API key helpers ────────────────────────────────────────────────────────────

def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def generate_api_key() -> str:
    return API_KEY_PREFIX + secrets.token_hex(32)


# ── FastAPI dependencies ──────────────────────────────────────────────────────

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticate via JWT (cookie or Bearer header). Raises 401 on failure."""
    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not token:
        token = request.cookies.get("ghost_token", "")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    # API key flow: token starts with ga_
    if token.startswith(API_KEY_PREFIX):
        return await _auth_api_key(token, db)

    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def _auth_api_key(raw_key: str, db: AsyncSession) -> User:
    """Validate an API key and return its owner user."""
    prefix = raw_key[:8 + len(API_KEY_PREFIX)]  # "ga_" + first 8 hex chars
    key_hash = _hash_key(raw_key)

    result = await db.execute(
        select(ApiKey).where(ApiKey.key_prefix == prefix, ApiKey.key_hash == key_hash, ApiKey.is_active == True)
    )
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    # Update last_used_at without loading the full row again
    await db.execute(
        update(ApiKey).where(ApiKey.id == api_key.id).values(last_used_at=datetime.utcnow())
    )

    user_result = await db.execute(select(User).where(User.id == api_key.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key owner not found")
    return user


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    try:
        return await get_current_user(request, db)
    except HTTPException:
        return None


def require_role(*roles: UserRole):
    """
    FastAPI dependency factory — restricts endpoint to users with given roles.
    Usage: Depends(require_role(UserRole.admin, UserRole.developer))
    """
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {[r.value for r in roles]}",
            )
        return current_user
    return _check


# Convenience shortcuts
require_admin     = require_role(UserRole.admin)
require_developer = require_role(UserRole.admin, UserRole.developer)
require_viewer    = require_role(UserRole.admin, UserRole.developer, UserRole.viewer)


# ── OAuth routes ──────────────────────────────────────────────────────────────

@router.get("/github/login")
async def github_login():
    if not settings.github_client_id:
        raise HTTPException(status_code=503, detail="GitHub OAuth not configured. Set GITHUB_CLIENT_ID.")
    url = (
        f"{GITHUB_AUTHORIZE_URL}"
        f"?client_id={settings.github_client_id}"
        f"&scope=repo,read:user,user:email"
    )
    return RedirectResponse(url)


@router.get("/github/callback")
async def github_callback(code: str, db: AsyncSession = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GITHUB_TOKEN_URL,
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json()
        gh_token = token_data.get("access_token")
        if not gh_token:
            raise HTTPException(status_code=400, detail="GitHub OAuth failed: no access token returned")

        user_resp = await client.get(
            GITHUB_USER_URL,
            headers={"Authorization": f"token {gh_token}", "Accept": "application/json"},
        )
        gh_user = user_resp.json()

    result = await db.execute(select(User).where(User.github_id == gh_user["id"]))
    user = result.scalar_one_or_none()

    if user:
        user.login        = gh_user.get("login", user.login)
        user.name         = gh_user.get("name")
        user.avatar_url   = gh_user.get("avatar_url")
        user.email        = gh_user.get("email")
        user.access_token = gh_token
        user.last_login   = datetime.utcnow()
    else:
        # First user becomes admin
        existing_count = (await db.execute(select(User))).all()
        user = User(
            github_id=gh_user["id"],
            login=gh_user.get("login", ""),
            name=gh_user.get("name"),
            avatar_url=gh_user.get("avatar_url"),
            email=gh_user.get("email"),
            access_token=gh_token,
            role=UserRole.admin if not existing_count else UserRole.developer,
        )
        db.add(user)

    await db.flush()
    await db.refresh(user)

    jwt_token = create_access_token(user.id)
    redirect_url = f"{settings.frontend_url}/auth/callback?token={jwt_token}"
    response = RedirectResponse(url=redirect_url)
    response.set_cookie(
        "ghost_token", jwt_token,
        httponly=True, samesite="lax",
        max_age=TOKEN_EXPIRE_DAYS * 86400,
    )
    return response


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("ghost_token", httponly=True, samesite="lax")
    return {"ok": True}


# ── API Key management routes ─────────────────────────────────────────────────

@router.post("/api-keys", tags=["api-keys"])
async def create_api_key(
    name: str,
    scopes: List[str] = None,
    current_user: User = Depends(require_developer),
    db: AsyncSession = Depends(get_db),
):
    """Create a new API key. Returns the raw key once — store it safely."""
    raw_key = generate_api_key()
    prefix = raw_key[:len(API_KEY_PREFIX) + 8]
    api_key = ApiKey(
        user_id=current_user.id,
        name=name,
        key_prefix=prefix,
        key_hash=_hash_key(raw_key),
        scopes=scopes or ["runs:read", "runs:trigger"],
    )
    db.add(api_key)
    await db.flush()
    return {
        "id": api_key.id,
        "name": api_key.name,
        "key": raw_key,   # shown only once
        "scopes": api_key.scopes,
        "created_at": api_key.created_at,
    }


@router.get("/api-keys", tags=["api-keys"])
async def list_api_keys(
    current_user: User = Depends(require_developer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ApiKey).where(ApiKey.user_id == current_user.id))
    keys = result.scalars().all()
    return [
        {
            "id": k.id,
            "name": k.name,
            "prefix": k.key_prefix,
            "scopes": k.scopes,
            "is_active": k.is_active,
            "last_used_at": k.last_used_at,
            "created_at": k.created_at,
        }
        for k in keys
    ]


@router.delete("/api-keys/{key_id}", tags=["api-keys"])
async def revoke_api_key(
    key_id: str,
    current_user: User = Depends(require_developer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == current_user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = False
    return {"ok": True}
