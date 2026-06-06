"""Sync Customer profile fields from LLM draft organize (separate from order_draft row)."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.order import OrderDraftUpdate
from app.services.user_service import update_user_info

logger = logging.getLogger(__name__)


async def apply_customer_phone_from_organize(
    db: AsyncSession,
    *,
    customer_id: int,
    draft_update: OrderDraftUpdate,
) -> str | None:
    """
    Persist LLM-extracted phone onto Customer when organize delta includes customer_phone.

    Returns the normalized phone written, or None when no phone field was sent.
    """

    if "customer_phone" not in draft_update.model_fields_set:
        return None

    phone = draft_update.customer_phone
    await update_user_info(
        db,
        customer_id,
        phone=phone,
        update_phone=True,
    )
    logger.info(
        "Organize synced customer_phone for customer_id=%s phone=%r",
        customer_id,
        phone,
    )
    return phone
