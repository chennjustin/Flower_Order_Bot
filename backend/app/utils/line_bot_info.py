"""LINE Messaging API helpers for provisioning (not webhook runtime)."""

from __future__ import annotations

import httpx

LINE_BOT_INFO_URL = "https://api.line.me/v2/bot/info"


async def fetch_line_bot_user_id(access_token: str) -> str:
    """
    Return bot userId from channel access token.
    Same value as webhook JSON "destination" -> store.slug.
    """
    token = (access_token or "").strip()
    if not token:
        raise ValueError("line_channel_access_token is empty")

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            LINE_BOT_INFO_URL,
            headers={"Authorization": f"Bearer {token}"},
        )

    if resp.status_code != 200:
        detail = resp.text[:200] if resp.text else resp.reason_phrase
        raise ValueError(
            f"LINE bot info failed ({resp.status_code}): {detail}. "
            "Check channel access token."
        )

    data = resp.json()
    user_id = (data.get("userId") or "").strip()
    if not user_id:
        raise ValueError("LINE bot info response missing userId")
    return user_id
