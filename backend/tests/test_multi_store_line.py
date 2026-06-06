"""Multi-store LINE routing and tenant scoping."""

import json

import pytest

from app.core.line_client import store_has_line_config
from app.models.store import Store
from app.repositories.store_repository import parse_webhook_destination


def test_parse_webhook_destination():
    body = json.dumps({"destination": "Udeadbeef", "events": []})
    assert parse_webhook_destination(body) == "Udeadbeef"


def test_parse_webhook_destination_missing():
    from fastapi import HTTPException

    with pytest.raises(HTTPException):
        parse_webhook_destination("{}")


def test_store_has_line_config_requires_slug_and_tokens():
    complete = Store(
        id=1,
        name="Test",
        owner_email="a@b.com",
        slug="Uabc",
        line_channel_access_token="tok",
        line_channel_secret="sec",
    )
    assert store_has_line_config(complete) is True

    incomplete = Store(
        id=1,
        name="Test",
        owner_email="a@b.com",
        slug=None,
        line_channel_access_token="tok",
        line_channel_secret="sec",
    )
    assert store_has_line_config(incomplete) is False


@pytest.mark.asyncio
async def test_resolve_store_unknown_destination_404(monkeypatch):
    """Unknown destination with no env fallback -> 404."""
    from unittest.mock import AsyncMock, MagicMock

    from fastapi import HTTPException

    from app.core.settings import Settings
    from app.repositories.store_repository import resolve_store_for_webhook

    async def _no_store(*_args, **_kwargs):
        return None

    async def _no_first_store(*_args, **_kwargs):
        return None

    monkeypatch.setattr(
        "app.repositories.store_repository.get_store_by_slug",
        _no_store,
    )
    monkeypatch.setattr(
        "app.repositories.store_repository.get_first_store_id",
        _no_first_store,
    )
    monkeypatch.setattr(
        "app.repositories.store_repository.load_settings",
        lambda: Settings(
            openai_api_key=None,
            line_channel_access_token=None,
            line_channel_secret=None,
            database_url="sqlite+aiosqlite:///",
            public_base_url="http://localhost:8000",
            supabase_url=None,
            supabase_anon_key=None,
            supabase_jwt_secret=None,
        ),
    )

    db = AsyncMock()
    body = json.dumps({"destination": "Unonexistent", "events": []})

    with pytest.raises(HTTPException) as exc_info:
        await resolve_store_for_webhook(db, body)

    assert exc_info.value.status_code == 404
