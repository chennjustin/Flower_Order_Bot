"""Helpers to use Supabase direct DB host instead of session pooler (EMAXCONNSESSION)."""

from __future__ import annotations

import re
from uuid import uuid4


def supabase_project_ref_from_url(url: str) -> str | None:
    """Extract project ref from user like postgres.<ref> in connection URL."""
    m = re.search(r"postgres\.([a-zA-Z0-9]+)", url)
    return m.group(1) if m else None


def is_supabase_pooler_url(url: str) -> bool:
    return "pooler.supabase.com" in url


def is_supabase_transaction_pooler_url(url: str) -> bool:
    return is_supabase_pooler_url(url) and ":6543" in url


def asyncpg_connect_args_for_url(url: str) -> dict:
    """
    PgBouncer transaction mode (:6543) cannot reuse asyncpg prepared statements.
    See: DuplicatePreparedStatementError / statement_cache_size=0.
    """
    if "postgresql+asyncpg" in url and is_supabase_transaction_pooler_url(url):
        return {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
        }
    return {}


def pooler_session_to_transaction(url: str, *, for_asyncpg: bool) -> str | None:
    """
    Session pooler (:5432) caps concurrent clients (EMAXCONNSESSION).
    Transaction pooler (:6543) suits short CLI / Alembic runs on the same host.
    """
    if not is_supabase_pooler_url(url) or ":6543" in url:
        return None
    if ":5432" not in url:
        return None
    out = url.replace("pooler.supabase.com:5432", "pooler.supabase.com:6543", 1)
    if for_asyncpg:
        if out.startswith("postgres://"):
            out = out.replace("postgres://", "postgresql+asyncpg://", 1)
        if out.startswith("postgresql+psycopg2://"):
            out = out.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
        out = out.replace("sslmode=require", "ssl=require")
    else:
        if out.startswith("postgres://"):
            out = out.replace("postgres://", "postgresql+psycopg2://", 1)
        if out.startswith("postgresql+asyncpg://"):
            out = out.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
        out = out.replace("ssl=require", "sslmode=require")
    return out


def pooler_url_to_direct(url: str, *, for_asyncpg: bool) -> str | None:
    """
    Rewrite pooler host to db.<ref>.supabase.co for migrations/CLI.
    Returns None if URL is not a Supabase pooler URL or ref cannot be parsed.
    """
    if not is_supabase_pooler_url(url):
        return None
    ref = supabase_project_ref_from_url(url)
    if not ref:
        return None

    out = re.sub(
        r"@[^/]*pooler\.supabase\.com:\d+",
        f"@db.{ref}.supabase.co:5432",
        url,
        count=1,
    )
    if for_asyncpg:
        if out.startswith("postgres://"):
            out = out.replace("postgres://", "postgresql+asyncpg://", 1)
        if out.startswith("postgresql+psycopg2://"):
            out = out.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
        out = out.replace("sslmode=require", "ssl=require")
    else:
        if out.startswith("postgres://"):
            out = out.replace("postgres://", "postgresql+psycopg2://", 1)
        if out.startswith("postgresql+asyncpg://"):
            out = out.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
        out = out.replace("ssl=require", "sslmode=require")
    return out
