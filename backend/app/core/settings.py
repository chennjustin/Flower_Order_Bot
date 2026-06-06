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
    redis_url: str | None

    # 建置圖片給對外 URL（LINE 推圖、後台顯示本機上傳圖）；ngrok／正式網域請改此值
    public_base_url: str
    # Supabase Auth：驗證前端帶來的 Bearer token（見 deps.get_current_user）
    supabase_url: str | None
    supabase_anon_key: str | None
    # 預留：未來本機驗證 JWT（HS256）時使用，目前未用到
    supabase_jwt_secret: str | None


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
        # asyncpg 用 ssl=require；Supabase 文件常寫 sslmode=require（僅 psycopg2）
        if "postgresql+asyncpg" in database_url:
            database_url = database_url.replace("sslmode=require", "ssl=require")
        return database_url
    if any(
        os.getenv(k)
        for k in ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "POSTGRES_HOST", "POSTGRES_PORT")
    ):
        return build_database_url_async()
    return "sqlite+aiosqlite:///messages.db"


def resolve_provision_database_url() -> str:
    """
    Async URL for one-off CLI (provision_stores).
    Prefers DATABASE_DIRECT_URL; else auto-rewrites pooler → db.<ref>.supabase.co.
    """
    load_dotenv()
    from app.core.supabase_db_url import pooler_session_to_transaction, pooler_url_to_direct

    direct = os.getenv("DATABASE_DIRECT_URL", "").strip()
    if direct:
        url = direct
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        if "postgresql+asyncpg" in url:
            url = url.replace("sslmode=require", "ssl=require")
        return url

    base = resolve_database_url()
    return (
        pooler_session_to_transaction(base, for_asyncpg=True)
        or pooler_url_to_direct(base, for_asyncpg=True)
        or base
    )


def resolve_database_alem_url() -> str:
    """Alembic 用同步 driver；直連優先，否則自動將 pooler 改為 db.<ref>.supabase.co。"""
    load_dotenv()
    from app.core.supabase_db_url import pooler_session_to_transaction, pooler_url_to_direct

    direct = os.getenv("DATABASE_ALEM_DIRECT_URL", "").strip()
    if direct:
        return direct
    explicit = os.getenv("DATABASE_ALEM_URL", "").strip()
    if explicit:
        return (
            pooler_session_to_transaction(explicit, for_asyncpg=False)
            or pooler_url_to_direct(explicit, for_asyncpg=False)
            or explicit
        )
    if any(
        os.getenv(k)
        for k in ("POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "POSTGRES_HOST", "POSTGRES_PORT")
    ):
        return build_database_url_sync_psycopg2()
    fallback = os.getenv("DATABASE_URL", "").strip()
    if fallback.startswith("sqlite+aiosqlite"):
        return "sqlite:///" + fallback.split("sqlite+aiosqlite:///", 1)[-1]
    if fallback.startswith("postgresql+asyncpg://"):
        fallback = fallback.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    if fallback:
        return (
            pooler_session_to_transaction(fallback, for_asyncpg=False)
            or pooler_url_to_direct(fallback, for_asyncpg=False)
            or fallback
        )
    return "sqlite:///messages.db"


def load_settings() -> Settings:
    """
    Central place to load environment variables.

    Keep dotenv loading here (instead of module import side-effects scattered
    across routes/services) so behavior stays the same but is easier to test.
    """
    database_url = resolve_database_url()

    pub = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")
    public_base_url = pub if pub else "http://localhost:8000"
    # deps 會組 f"{supabase_url}/auth/v1/user"，故去掉尾端斜線避免雙斜線
    supabase_url = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/") or None
    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        line_channel_access_token=os.getenv("LINE_CHANNEL_ACCESS_TOKEN"),
        line_channel_secret=os.getenv("LINE_CHANNEL_SECRET"),
        database_url=database_url,
        public_base_url=public_base_url,
        supabase_url=supabase_url,
        supabase_anon_key=os.getenv("SUPABASE_ANON_KEY") or None,
        supabase_jwt_secret=os.getenv("SUPABASE_JWT_SECRET") or None,
    )

