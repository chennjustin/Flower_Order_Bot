"""向後相容：請改用 app.schemas.customer。"""

from app.schemas.customer import (
    CustomerBase,
    CustomerCreate,
    CustomerRead,
)

UserBase = CustomerBase
UserCreate = CustomerCreate
UserRead = CustomerRead

__all__ = [
    "CustomerBase",
    "CustomerCreate",
    "CustomerRead",
    "UserBase",
    "UserCreate",
    "UserRead",
]
