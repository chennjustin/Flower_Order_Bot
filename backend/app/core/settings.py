from __future__ import annotations

import os
from dataclasses import dataclass
from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    openai_api_key: str | None
    line_channel_access_token: str | None
    line_channel_secret: str | None
    database_url: str


def load_settings() -> Settings:
    """
    Central place to load environment variables.

    Keep dotenv loading here (instead of module import side-effects scattered
    across routes/services) so behavior stays the same but is easier to test.
    """
    load_dotenv()

    database_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///messages.db")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+asyncpg://", 1)

    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        line_channel_access_token=os.getenv("LINE_CHANNEL_ACCESS_TOKEN"),
        line_channel_secret=os.getenv("LINE_CHANNEL_SECRET"),
        database_url=database_url,
    )

