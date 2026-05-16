from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class StoreBase(BaseModel):
    name: str
    slug: Optional[str] = None
    timezone: str = "Asia/Taipei"
    active: bool = True


class StoreRead(StoreBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_auth_user_id: UUID
    created_at: datetime
    updated_at: datetime
