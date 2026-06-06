"""Store provisioning schema and LINE bot info helper."""

import pytest

from app.schemas.store_provision import StoreProvisionEntry, StoreProvisionFile


def test_provision_email_lowercased():
    entry = StoreProvisionEntry(
        name="Test",
        owner_email="Owner@Gmail.COM",
        line_channel_access_token="tok",
        line_channel_secret="sec",
    )
    assert entry.owner_email == "owner@gmail.com"


def test_provision_file_requires_stores():
    payload = StoreProvisionFile.model_validate(
        {
            "stores": [
                {
                    "name": "A",
                    "owner_email": "a@b.com",
                    "line_channel_access_token": "t",
                    "line_channel_secret": "s",
                }
            ]
        }
    )
    assert len(payload.stores) == 1


@pytest.mark.asyncio
async def test_fetch_line_bot_user_id_parses_response(monkeypatch):
    from app.utils import line_bot_info

    class FakeResp:
        status_code = 200

        def json(self):
            return {"userId": "Utest123", "displayName": "Bot"}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, url, headers=None):
            assert "Bearer mytoken" in headers["Authorization"]
            return FakeResp()

    monkeypatch.setattr(line_bot_info.httpx, "AsyncClient", lambda **kw: FakeClient())
    uid = await line_bot_info.fetch_line_bot_user_id("mytoken")
    assert uid == "Utest123"
