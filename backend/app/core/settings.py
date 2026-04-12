from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import quote_plus

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    openai_api_key: str | None
    line_channel_access_token: str | None
    line_channel_secret: str | None
    database_url: str


def _postgres_connection_params() -> tuple[str, str, str, str, str]:
    load_dotenv()
    user = os.getenv("POSTGRES_USER", "flower")
    password = os.getenv("POSTGRES_PASSWORD", "flower")
    db = os.getenv("POSTGRES_DB", "flower")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    return user, password, db, host, port


def build_database_url_async() -> str:
    user, password, db, host, port = _postgres_connection_params()
    u = quote_plus(user)
    p = quote_plus(password)
    return f"postgresql+asyncpg://{u}:{p}@{host}:{port}/{db}"


def build_database_url_sync_psycopg2() -> str:
    user, password, db, host, port = _postgres_connection_params()
    u = quote_plus(user)
    p = quote_plus(password)
    return f"postgresql+psycopg2://{u}:{p}@{host}:{port}/{db}"


def resolve_database_url() -> str:
    """
    DATABASE_URL 若設定則優先（舊版相容）。
    否則若偵測到任一 POSTGRES_* 則組 asyncpg URL；再否則回退 sqlite。
    """
    load_dotenv()
    explicit = os.getenv("DATABASE_URL", "").strip()
    if explicit:
        database_url = explicit
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)
        return database_url
    if any(
        os.getenv(k)
        for k in ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "POSTGRES_HOST", "POSTGRES_PORT")
    ):
        return build_database_url_async()
    return "sqlite+aiosqlite:///messages.db"


def resolve_database_alem_url() -> str:
    """Alembic 用同步 driver；DATABASE_ALEM_URL 優先。"""
    load_dotenv()
    explicit = os.getenv("DATABASE_ALEM_URL", "").strip()
    if explicit:
        return explicit
    if any(
        os.getenv(k)
        for k in ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "POSTGRES_HOST", "POSTGRES_PORT")
    ):
        return build_database_url_sync_psycopg2()
    fallback = os.getenv("DATABASE_URL", "").strip()
    if fallback.startswith("sqlite+aiosqlite"):
        return "sqlite:///" + fallback.split("sqlite+aiosqlite:///", 1)[-1]
    if fallback.startswith("postgresql+asyncpg://"):
        return fallback.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    if fallback:
        return fallback
    return "sqlite:///messages.db"


def load_settings() -> Settings:
    """
    Central place to load environment variables.

    Keep dotenv loading here (instead of module import side-effects scattered
    across routes/services) so behavior stays the same but is easier to test.
    """
    database_url = resolve_database_url()

    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        line_channel_access_token=os.getenv("LINE_CHANNEL_ACCESS_TOKEN"),
        line_channel_secret=os.getenv("LINE_CHANNEL_SECRET"),
        database_url=database_url,
    )

