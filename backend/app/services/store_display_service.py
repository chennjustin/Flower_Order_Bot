from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.store_display_repository import (
    create_store_display_config,
    get_store_display_config,
    save_store_display_config,
)
from app.schemas.store_display import StoreDisplayFieldsOut, VisiblePayloadOut
from app.services.order_service import get_order_draft_out_by_room

DEFAULT_VISIBLE_ORDER_FIELDS = [
    "id",
    "customer_name",
    "customer_phone",
    "receiver_name",
    "receiver_phone",
    "order_date",
    "pay_way",
    "total_amount",
    "item",
    "quantity",
    "note",
    "card_message",
    "shipment_method",
    "weekday",
    "send_datetime",
    "receipt_address",
    "delivery_address",
]


def _normalize_visible_fields(fields: list[str] | None) -> list[str]:
    if not fields:
        return DEFAULT_VISIBLE_ORDER_FIELDS.copy()
    ordered_unique: list[str] = []
    for field in fields:
        if field not in ordered_unique:
            ordered_unique.append(field)
    return ordered_unique


async def get_or_init_store_display_fields(db: AsyncSession, store_key: str) -> StoreDisplayFieldsOut:
    config = await get_store_display_config(db, store_key)
    if not config:
        config = await create_store_display_config(
            db=db,
            store_key=store_key,
            visible_fields=DEFAULT_VISIBLE_ORDER_FIELDS.copy(),
            updated_by_staff_id=None,
        )
    visible_fields = _normalize_visible_fields(config.visible_fields)
    return StoreDisplayFieldsOut(
        store_key=config.store_key,
        visible_fields=visible_fields,
        updated_by_staff_id=config.updated_by_staff_id,
        updated_at=config.updated_at,
    )


async def update_store_display_fields(
    db: AsyncSession,
    store_key: str,
    visible_fields: list[str],
    updated_by_staff_id: int | None = None,
) -> StoreDisplayFieldsOut:
    normalized_fields = _normalize_visible_fields(visible_fields)
    config = await get_store_display_config(db, store_key)
    if not config:
        config = await create_store_display_config(
            db=db,
            store_key=store_key,
            visible_fields=normalized_fields,
            updated_by_staff_id=updated_by_staff_id,
        )
    else:
        config = await save_store_display_config(
            db=db,
            config=config,
            visible_fields=normalized_fields,
            updated_by_staff_id=updated_by_staff_id,
        )
    return StoreDisplayFieldsOut(
        store_key=config.store_key,
        visible_fields=normalized_fields,
        updated_by_staff_id=config.updated_by_staff_id,
        updated_at=config.updated_at,
    )


def _filter_payload(payload: dict, visible_fields: list[str]) -> dict:
    return {k: v for k, v in payload.items() if k in visible_fields}


async def get_visible_order_draft_payload(
    db: AsyncSession, store_key: str, room_id: int
) -> VisiblePayloadOut:
    display_config = await get_or_init_store_display_fields(db, store_key)
    order_draft = await get_order_draft_out_by_room(db, room_id)
    if not order_draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order draft for room {room_id} not found.",
        )
    payload = order_draft.model_dump()
    return VisiblePayloadOut(
        store_key=store_key,
        visible_fields=display_config.visible_fields,
        payload=_filter_payload(payload, display_config.visible_fields),
    )

