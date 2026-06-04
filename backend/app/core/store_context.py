"""Resolve the active store for multi-tenant staff API requests."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.store import Store

# Header name used by the frontend axios interceptor (Step 6).
STORE_ID_HEADER = "X-Store-Id"


def _parse_positive_int(raw: str, source: str) -> int:
    try:
        value = int(raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {source}: must be a positive integer.",
        ) from exc
    if value <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {source}: must be a positive integer.",
        )
    return value


def parse_store_id(
    *,
    header_value: str | None,
    query_value: int | None,
) -> int | None:
    """
    Resolve store id from request inputs.

    Priority: X-Store-Id header, then store_id query parameter.
    """
    if header_value is not None:
        stripped = str(header_value).strip()
        if stripped:
            return _parse_positive_int(stripped, STORE_ID_HEADER)

    if query_value is not None:
        if query_value <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid store_id query: must be a positive integer.",
            )
        return int(query_value)

    return None


async def assert_store_exists(db: AsyncSession, store_id: int) -> None:
    result = await db.execute(select(Store.id).where(Store.id == store_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store {store_id} not found.",
        )


async def resolve_store_id(
    db: AsyncSession,
    *,
    header_value: str | None = None,
    query_value: int | None = None,
) -> int:
    """Return validated store id or raise 400/404."""
    store_id = parse_store_id(header_value=header_value, query_value=query_value)
    if store_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Missing store id. Provide X-Store-Id header or store_id query parameter."
            ),
        )
    await assert_store_exists(db, store_id)
    return store_id


async def require_path_store_id_matches(
    path_store_id: int,
    resolved_store_id: int,
) -> None:
    """Ensure URL path store_id matches the resolved active store (Step 4)."""
    if path_store_id != resolved_store_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="store_id in URL does not match active store context.",
        )


async def get_resolved_store_id(
    db: AsyncSession = Depends(get_db),
    x_store_id: Annotated[str | None, Header(alias=STORE_ID_HEADER)] = None,
    store_id_query: Annotated[
        int | None, Query(alias="store_id", description="Active store id")
    ] = None,
) -> int:
    """FastAPI dependency: header-first, then query store_id."""
    return await resolve_store_id(
        db,
        header_value=x_store_id,
        query_value=store_id_query,
    )


async def get_resolved_store_id_with_path(
    store_id: int,
    db: AsyncSession = Depends(get_db),
    x_store_id: Annotated[str | None, Header(alias=STORE_ID_HEADER)] = None,
    store_id_query: Annotated[
        int | None, Query(alias="store_id", description="Active store id")
    ] = None,
) -> int:
    """FastAPI dependency for routes that also include store_id in the path."""
    resolved = await resolve_store_id(
        db,
        header_value=x_store_id,
        query_value=store_id_query,
    )
    await require_path_store_id_matches(store_id, resolved)
    return resolved
