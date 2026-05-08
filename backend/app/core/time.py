from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

# Central timezone config (GMT+8 / 台北時間)
TAIPEI_TZ = ZoneInfo("Asia/Taipei")


def now_taipei() -> datetime:
    """Timezone-aware now in Asia/Taipei."""
    return datetime.now(TAIPEI_TZ)


def now_taipei_naive() -> datetime:
    """
    Naive datetime representing Asia/Taipei wall time.

    We store naive timestamps in DB columns (DateTime without timezone),
    but they are always interpreted as GMT+8.
    """
    return now_taipei().replace(tzinfo=None)


def to_taipei_naive(dt: datetime) -> datetime:
    """
    Convert an incoming datetime to Asia/Taipei naive wall time.

    - If `dt` is timezone-aware: convert to Asia/Taipei then drop tzinfo.
    - If `dt` is naive: assume it is already Asia/Taipei wall time.
    """
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(TAIPEI_TZ).replace(tzinfo=None)


def to_taipei_aware(dt: datetime) -> datetime:
    """
    Convert an incoming datetime to Asia/Taipei timezone-aware datetime.

    - If `dt` is timezone-aware: convert to Asia/Taipei.
    - If `dt` is naive: assume it is already Asia/Taipei wall time and attach tzinfo.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=TAIPEI_TZ)
    return dt.astimezone(TAIPEI_TZ)

