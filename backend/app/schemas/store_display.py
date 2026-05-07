from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class StoreDisplayFieldsUpdate(BaseModel):
    visible_fields: list[str] = Field(default_factory=list)
    updated_by_staff_id: int | None = None


class StoreDisplayFieldsOut(BaseModel):
    store_key: str
    visible_fields: list[str]
    updated_by_staff_id: int | None = None
    updated_at: datetime | None = None


class VisiblePayloadOut(BaseModel):
    store_key: str
    visible_fields: list[str]
    payload: dict[str, Any]

