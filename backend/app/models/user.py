"""向後相容：舊程式碼的 User 即 Customer。"""

from app.models.customer import Customer

User = Customer

__all__ = ["User", "Customer"]
