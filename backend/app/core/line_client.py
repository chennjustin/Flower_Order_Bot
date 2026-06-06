"""Per-store LINE Messaging API clients."""

from __future__ import annotations

from linebot import LineBotApi, WebhookHandler

from app.core.settings import load_settings
from app.models.store import Store


def store_has_line_config(store: Store) -> bool:
    return bool(
        (store.slug or "").strip()
        and (store.line_channel_access_token or "").strip()
        and (store.line_channel_secret or "").strip()
    )


def _access_token(store: Store) -> str:
    token = (store.line_channel_access_token or "").strip()
    if not token:
        token = (load_settings().line_channel_access_token or "").strip()
    if not token:
        raise ValueError(f"Store {store.id} has no LINE access token")
    return token


def _channel_secret(store: Store) -> str:
    secret = (store.line_channel_secret or "").strip()
    if not secret:
        secret = (load_settings().line_channel_secret or "").strip()
    if not secret:
        raise ValueError(f"Store {store.id} has no LINE channel secret")
    return secret


def line_bot_api_for_store(store: Store) -> LineBotApi:
    return LineBotApi(_access_token(store))


def webhook_handler_for_store(store: Store) -> WebhookHandler:
    return WebhookHandler(_channel_secret(store))
