from __future__ import annotations

from functools import lru_cache

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from linebot import LineBotApi, WebhookHandler
from openai import OpenAI

from app.core.settings import Settings, load_settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()


@lru_cache(maxsize=1)
def get_openai_client() -> OpenAI:
    settings = get_settings()
    return OpenAI(api_key=settings.openai_api_key)


@lru_cache(maxsize=1)
def get_line_bot_api() -> LineBotApi:
    settings = get_settings()
    return LineBotApi(settings.line_channel_access_token)


@lru_cache(maxsize=1)
def get_line_webhook_handler() -> WebhookHandler:
    settings = get_settings()
    return WebhookHandler(settings.line_channel_secret)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    settings = get_settings()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_anon_key,
                },
                timeout=5.0,
            )
    except Exception:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return resp.json()

