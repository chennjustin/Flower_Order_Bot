from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CustomerBase(BaseModel):
    line_uid: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class CustomerCreate(CustomerBase):
    name: str
    store_id: Optional[int] = None
    has_ordered: bool = False


class CustomerRead(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    has_ordered: bool
    created_at: datetime
    updated_at: datetime
