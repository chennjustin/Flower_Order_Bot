from __future__ import annotations

import os
from functools import lru_cache

import redis.asyncio as aioredis
from dotenv import load_dotenv

_redis_client: aioredis.Redis | None = None


def resolve_redis_url() -> str | None:
    load_dotenv()
    url = os.getenv("REDIS_URL", "").strip()
    return url or None


@lru_cache
def is_redis_enabled() -> bool:
    return resolve_redis_url() is not None


async def get_redis() -> aioredis.Redis | None:
    global _redis_client
    url = resolve_redis_url()
    if not url:
        return None
    if _redis_client is None:
        _redis_client = aioredis.from_url(url, decode_responses=True)
    return _redis_client


async def close_redis() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
