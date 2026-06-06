"""Tests for settings.py changes introduced in the multitenant PR.

The new logic in resolve_database_url() converts ``sslmode=require`` to
``ssl=require`` when the URL uses the ``postgresql+asyncpg`` driver, because
asyncpg does not understand the psycopg2-style ``sslmode`` parameter.
"""
import importlib
import os

import pytest


def _reload_and_call(monkeypatch, env: dict) -> str:
    """Set env vars, reload settings module, call resolve_database_url()."""
    # Clear all relevant env vars first
    for key in (
        "DATABASE_URL",
        "DATABASE_ALEM_URL",
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "POSTGRES_DB",
        "POSTGRES_HOST",
        "POSTGRES_PORT",
    ):
        monkeypatch.delenv(key, raising=False)

    for k, v in env.items():
        monkeypatch.setenv(k, v)

    import app.core.settings as settings_mod

    importlib.reload(settings_mod)
    return settings_mod.resolve_database_url()


# ---------------------------------------------------------------------------
# sslmode → ssl conversion for asyncpg
# ---------------------------------------------------------------------------


def test_asyncpg_url_with_sslmode_is_rewritten(monkeypatch):
    url = "postgresql+asyncpg://user:pass@host:5432/db?sslmode=require"
    result = _reload_and_call(monkeypatch, {"DATABASE_URL": url})
    assert "ssl=require" in result
    assert "sslmode=require" not in result


def test_asyncpg_url_already_has_ssl_not_double_converted(monkeypatch):
    url = "postgresql+asyncpg://user:pass@host:5432/db?ssl=require"
    result = _reload_and_call(monkeypatch, {"DATABASE_URL": url})
    assert "ssl=require" in result
    assert "sslmode" not in result


def test_psycopg2_url_sslmode_not_touched(monkeypatch):
    """psycopg2 URLs should NOT have sslmode replaced."""
    url = "postgresql+psycopg2://user:pass@host:5432/db?sslmode=require"
    result = _reload_and_call(monkeypatch, {"DATABASE_URL": url})
    assert "sslmode=require" in result


def test_postgres_scheme_rewritten_to_asyncpg(monkeypatch):
    """Plain ``postgres://`` scheme should be converted to ``postgresql+asyncpg://``."""
    url = "postgres://user:pass@host:5432/db"
    result = _reload_and_call(monkeypatch, {"DATABASE_URL": url})
    assert result.startswith("postgresql+asyncpg://")


def test_postgres_scheme_with_sslmode_fully_fixed(monkeypatch):
    """``postgres://`` with ``sslmode=require`` gets both fixes applied."""
    url = "postgres://user:pass@host:5432/db?sslmode=require"
    result = _reload_and_call(monkeypatch, {"DATABASE_URL": url})
    assert result.startswith("postgresql+asyncpg://")
    assert "ssl=require" in result
    assert "sslmode=require" not in result


def test_no_database_url_falls_back_to_sqlite(monkeypatch):
    """When no DATABASE_URL and no POSTGRES_* are set, returns sqlite fallback."""
    result = _reload_and_call(monkeypatch, {})
    assert "sqlite" in result


def test_postgres_env_vars_build_asyncpg_url(monkeypatch):
    result = _reload_and_call(
        monkeypatch,
        {
            "POSTGRES_USER": "flower",
            "POSTGRES_PASSWORD": "flower",
            "POSTGRES_DB": "flower",
            "POSTGRES_HOST": "localhost",
            "POSTGRES_PORT": "5434",
        },
    )
    assert "postgresql+asyncpg" in result
    assert "flower" in result
    assert "localhost" in result
    assert "5434" in result


def test_explicit_database_url_takes_priority_over_postgres_vars(monkeypatch):
    """DATABASE_URL should be used even when POSTGRES_* vars are also present."""
    result = _reload_and_call(
        monkeypatch,
        {
            "DATABASE_URL": "postgresql+asyncpg://explicit:pw@host/db",
            "POSTGRES_USER": "other",
            "POSTGRES_HOST": "other-host",
        },
    )
    assert "explicit" in result
    assert "other-host" not in result