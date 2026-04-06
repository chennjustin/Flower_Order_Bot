from __future__ import annotations

from functools import lru_cache

from linebot import LineBotApi, WebhookHandler
from openai import OpenAI

from app.core.settings import Settings, load_settings


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

