"""Schemas for store listing (multi-tenant picker)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class StoreListItem(BaseModel):
    id: int
    name: str
    slug: str | None = None
    onboarding_done: bool = False


class LineOfficialDisplay(BaseModel):
    display_name: str
    basic_id: str | None = None
    user_id: str | None = None
    image_url: str | None = None


class StoreOnboardingContext(BaseModel):
    id: int
    name: str
    slug: str | None = None
    line_official: LineOfficialDisplay


class StoreNameUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32)


class StoreNameUpdateResponse(BaseModel):
    name: str
