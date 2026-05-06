from datetime import datetime, timedelta, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class StoreDisplayConfig(Base):
    __tablename__ = "store_display_config"

    id: Mapped[int] = mapped_column(primary_key=True)
    store_key: Mapped[str] = mapped_column(String, unique=True, index=True)
    visible_fields: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    updated_by_staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff_user.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        onupdate=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
    )

