from __future__ import annotations

from pydantic import BaseModel, Field


class OrderFieldConfigUpdate(BaseModel):
    """Partial update: only sent fields are applied."""

    visible_fields: list[str] | None = None
    field_order: list[str] | None = None
    organize_required_fields: list[str] | None = None


class OrderFieldConfigOut(BaseModel):
    store_id: int
    visible_fields: list[str] = Field(default_factory=list)
    field_order: list[str] = Field(default_factory=list)
    organize_required_fields: list[str] = Field(default_factory=list)
    fixed_visible_fields: list[str] = Field(default_factory=list)
    optional_visible_fields: list[str] = Field(default_factory=list)
    optional_organize_fields: list[str] = Field(default_factory=list)
