from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import now_taipei_naive
from app.models.order_field_config import StoreOrderFieldConfig
from app.models.store import Store
from app.schemas.order_field_config import OrderFieldConfigOut, OrderFieldConfigUpdate

FIXED_VISIBLE_FIELDS: tuple[str, ...] = (
    "id",
    "customer_name",
    "customer_phone",
    "item",
    "order_status",
    "send_datetime",
    "total_amount",
)

OPTIONAL_VISIBLE_FIELDS: tuple[str, ...] = (
    "quantity",
    "note",
    "shipment_method",
    "delivery_address",
    "pay_way",
    "pay_status",
    "order_date",
)

OPTIONAL_ORGANIZE_FIELDS: tuple[str, ...] = (
    "quantity",
    "note",
    "shipment_method",
    "delivery_address",
    "pay_way",
)

CORE_ORGANIZE_FIELDS: tuple[str, ...] = (
    "customer_name",
    "customer_phone",
    "item",
    "send_datetime",
    "total_amount",
)


@dataclass
class EffectiveOrderFieldConfig:
    store_id: int
    visible_fields: list[str]
    organize_required_fields: list[str]


def _normalize_visible_fields(raw_fields: list[str] | None) -> list[str]:
    allowed = set(FIXED_VISIBLE_FIELDS) | set(OPTIONAL_VISIBLE_FIELDS)
    normalized = [f for f in (raw_fields or []) if f in allowed]
    ordered = [f for f in FIXED_VISIBLE_FIELDS]
    ordered.extend(f for f in OPTIONAL_VISIBLE_FIELDS if f in normalized)
    return ordered


def _normalize_organize_required_fields(raw_fields: list[str] | None) -> list[str]:
    selected = set(raw_fields or [])
    return [f for f in OPTIONAL_ORGANIZE_FIELDS if f in selected]


def _resolve_optional_required_fields(
    visible_fields: list[str], organize_required_fields: list[str] | None
) -> list[str]:
    visible_optional_required = [f for f in OPTIONAL_ORGANIZE_FIELDS if f in set(visible_fields)]
    manual_optional_required = _normalize_organize_required_fields(organize_required_fields)
    return [
        f
        for f in OPTIONAL_ORGANIZE_FIELDS
        if f in (set(visible_optional_required) | set(manual_optional_required))
    ]


async def _get_store_or_404(db: AsyncSession, store_id: int) -> Store:
    result = await db.execute(select(Store).where(Store.id == store_id))
    store = result.scalar_one_or_none()
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store {store_id} not found.",
        )
    return store


async def _get_or_create_config(db: AsyncSession, store_id: int) -> StoreOrderFieldConfig:
    result = await db.execute(
        select(StoreOrderFieldConfig).where(StoreOrderFieldConfig.store_id == store_id)
    )
    config = result.scalar_one_or_none()
    if config:
        return config

    config = StoreOrderFieldConfig(
        store_id=store_id,
        visible_fields=_normalize_visible_fields(None),
        organize_required_fields=[],
        created_at=now_taipei_naive(),
        updated_at=now_taipei_naive(),
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


def _to_out(config: StoreOrderFieldConfig) -> OrderFieldConfigOut:
    return OrderFieldConfigOut(
        store_id=config.store_id,
        visible_fields=_normalize_visible_fields(config.visible_fields),
        organize_required_fields=_normalize_organize_required_fields(
            config.organize_required_fields
        ),
        fixed_visible_fields=list(FIXED_VISIBLE_FIELDS),
        optional_visible_fields=list(OPTIONAL_VISIBLE_FIELDS),
        optional_organize_fields=list(OPTIONAL_ORGANIZE_FIELDS),
    )


async def get_order_field_config(db: AsyncSession, store_id: int) -> OrderFieldConfigOut:
    await _get_store_or_404(db, store_id)
    config = await _get_or_create_config(db, store_id)
    return _to_out(config)


async def update_order_field_config(
    db: AsyncSession, store_id: int, payload: OrderFieldConfigUpdate
) -> OrderFieldConfigOut:
    await _get_store_or_404(db, store_id)
    config = await _get_or_create_config(db, store_id)

    if payload.visible_fields is not None:
        config.visible_fields = _normalize_visible_fields(payload.visible_fields)
    if payload.organize_required_fields is not None:
        config.organize_required_fields = _normalize_organize_required_fields(
            payload.organize_required_fields
        )
    config.updated_at = now_taipei_naive()

    db.add(config)
    await db.commit()
    await db.refresh(config)
    return _to_out(config)


async def get_effective_order_field_config(
    db: AsyncSession, store_id: int
) -> EffectiveOrderFieldConfig:
    await _get_store_or_404(db, store_id)
    config = await _get_or_create_config(db, store_id)
    visible_fields = _normalize_visible_fields(config.visible_fields)
    optional_required = _resolve_optional_required_fields(
        visible_fields, config.organize_required_fields
    )
    return EffectiveOrderFieldConfig(
        store_id=store_id,
        visible_fields=visible_fields,
        organize_required_fields=[*CORE_ORGANIZE_FIELDS, *optional_required],
    )
