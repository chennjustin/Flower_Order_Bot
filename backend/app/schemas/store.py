"""Schemas for store listing (multi-tenant picker)."""

from __future__ import annotations

from pydantic import BaseModel


class StoreListItem(BaseModel):
    id: int
    name: str
    slug: str | None = None
