from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class StoreProvisionEntry(BaseModel):
    name: str
    owner_email: str
    line_channel_access_token: str
    line_channel_secret: str
    slug: str | None = None
    timezone: str = "Asia/Taipei"
    active: bool = True

    @field_validator("name", "owner_email", "line_channel_access_token", "line_channel_secret", "slug")
    @classmethod
    def strip_strings(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return v.strip()

    @field_validator("owner_email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.strip().lower()


class StoreProvisionFile(BaseModel):
    stores: list[StoreProvisionEntry] = Field(min_length=1)
