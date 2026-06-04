from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import now_taipei_naive
from app.domain.order_fields import (
    ALL_CATALOG_KEYS,
    CORE_ORGANIZE_FIELDS,
    FIXED_VISIBLE_FIELDS,
    OPTIONAL_ORGANIZE_FIELDS,
    OPTIONAL_VISIBLE_FIELDS,
    build_display_config,
    is_catalog_field_key,
)
from app.models.order_field_config import StoreOrderFieldConfig
from app.models.store import Store
from app.schemas.order_field_config import OrderFieldConfigOut, OrderFieldConfigUpdate

# Re-export catalog constants for callers/tests that import from this module.
__all__ = [
    "EffectiveOrderFieldConfig",
    "CORE_ORGANIZE_FIELDS",
    "FIXED_VISIBLE_FIELDS",
    "OPTIONAL_ORGANIZE_FIELDS",
    "OPTIONAL_VISIBLE_FIELDS",
    "get_effective_order_field_config",
    "get_order_field_config",
    "update_order_field_config",
    "_normalize_field_order",
    "_normalize_visible_fields",
    "_order_visible_by_field_order",
]


@dataclass
class EffectiveOrderFieldConfig:
    store_id: int
    visible_fields: list[str]
    field_order: list[str]
    organize_required_fields: list[str]


def _normalize_visible_fields(raw_fields: list[str] | None) -> list[str]:
    """Fixed keys always included; optional keys only if listed in raw input."""
    allowed = set(FIXED_VISIBLE_FIELDS) | set(OPTIONAL_VISIBLE_FIELDS)
    normalized = [f for f in (raw_fields or []) if f in allowed]
    ordered = [f for f in FIXED_VISIBLE_FIELDS]
    ordered.extend(f for f in OPTIONAL_VISIBLE_FIELDS if f in normalized)
    return ordered


def _normalize_field_order(raw_order: list[str] | None) -> list[str]:
    """Catalog keys only; preserve order; append any missing keys at the end."""
    if not raw_order:
        return list(ALL_CATALOG_KEYS)

    seen: set[str] = set()
    ordered: list[str] = []
    for key in raw_order:
        if is_catalog_field_key(key) and key not in seen:
            ordered.append(key)
            seen.add(key)
    for key in ALL_CATALOG_KEYS:
        if key not in seen:
            ordered.append(key)
    return ordered


def _order_visible_by_field_order(
    visible_fields: list[str], field_order: list[str]
) -> list[str]:
    """Return visible keys sorted by store field_order (not fixed/optional buckets)."""
    visible_set = set(visible_fields)
    ordered = [key for key in field_order if key in visible_set]
    for key in visible_fields:
        if key not in ordered:
            ordered.append(key)
    return ordered


def _load_display_settings(
    config: StoreOrderFieldConfig,
) -> tuple[list[str], list[str]]:
    """Read visible_fields + field_order from display_config with legacy fallback."""
    display = config.display_config
    if isinstance(display, dict):
        raw_visible = display.get("visible_fields")
        raw_order = display.get("field_order")
        if isinstance(raw_visible, list) and isinstance(raw_order, list):
            visible = _normalize_visible_fields(raw_visible)
            field_order = _normalize_field_order(raw_order)
            return visible, field_order

    visible = _normalize_visible_fields(config.visible_fields)
    return visible, list(ALL_CATALOG_KEYS)


def _persist_display_settings(
    config: StoreOrderFieldConfig,
    visible_fields: list[str],
    field_order: list[str],
) -> None:
    """Write display_config JSON and keep legacy visible_fields column in sync."""
    config.display_config = build_display_config(visible_fields, field_order)
    config.visible_fields = visible_fields


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

    normalized_visible = _normalize_visible_fields(None)
    field_order = list(ALL_CATALOG_KEYS)
    config = StoreOrderFieldConfig(
        store_id=store_id,
        visible_fields=normalized_visible,
        display_config=build_display_config(normalized_visible, field_order),
        organize_required_fields=[],
        created_at=now_taipei_naive(),
        updated_at=now_taipei_naive(),
    )
    db.add(config)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        result = await db.execute(
            select(StoreOrderFieldConfig).where(StoreOrderFieldConfig.store_id == store_id)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing
        raise
    await db.refresh(config)
    return config


def _to_out(config: StoreOrderFieldConfig) -> OrderFieldConfigOut:
    visible_fields, field_order = _load_display_settings(config)
    return OrderFieldConfigOut(
        store_id=config.store_id,
        visible_fields=_order_visible_by_field_order(visible_fields, field_order),
        field_order=field_order,
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

    visible_fields, field_order = _load_display_settings(config)

    if payload.visible_fields is not None:
        visible_fields = _normalize_visible_fields(payload.visible_fields)
    if payload.field_order is not None:
        field_order = _normalize_field_order(payload.field_order)

    _persist_display_settings(config, visible_fields, field_order)

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
    visible_fields, field_order = _load_display_settings(config)
    ordered_visible = _order_visible_by_field_order(visible_fields, field_order)
    optional_required = _resolve_optional_required_fields(
        ordered_visible, config.organize_required_fields
    )
    return EffectiveOrderFieldConfig(
        store_id=store_id,
        visible_fields=ordered_visible,
        field_order=field_order,
        organize_required_fields=[*CORE_ORGANIZE_FIELDS, *optional_required],
    )
