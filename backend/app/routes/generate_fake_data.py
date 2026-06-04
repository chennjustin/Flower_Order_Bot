from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

from app.seeds.seed_all import ORDERS_PER_API_CALL, generate_fake_data

api_router = APIRouter()


@api_router.get("/generate-fake-data")
async def generate_data(count: int | None = None) -> PlainTextResponse:
    """Always seed 10 orders on store id=1. `count` kept for Swagger compatibility."""
    _ = count
    try:
        await generate_fake_data(ORDERS_PER_API_CALL)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PlainTextResponse(f"OK: created {ORDERS_PER_API_CALL} orders")
