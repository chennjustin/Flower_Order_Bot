"""Tests for EnsureCorsHeadersMiddleware changes in app/main.py.

The PR wrapped call_next in try/except so that unhandled exceptions still
return a response with CORS headers instead of propagating as a raw 500.

Tests here use a minimal Starlette ASGI app to keep database out of scope.
"""
import pytest
import httpx
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

from app.main import EnsureCorsHeadersMiddleware


# ---------------------------------------------------------------------------
# Helpers – build a minimal ASGI app with the middleware
# ---------------------------------------------------------------------------


def _make_app(handler) -> Starlette:
    """Create a minimal Starlette app with EnsureCorsHeadersMiddleware applied."""
    app = Starlette(routes=[Route("/test", handler)])
    app.add_middleware(EnsureCorsHeadersMiddleware)
    return app


# ---------------------------------------------------------------------------
# Normal (no-exception) path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_no_origin_header_response_unchanged():
    async def handler(request: Request) -> Response:
        return Response("OK", status_code=200)

    transport = httpx.ASGITransport(app=_make_app(handler))
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/test")  # no Origin header
    assert r.status_code == 200
    assert "access-control-allow-origin" not in r.headers


@pytest.mark.asyncio
async def test_with_origin_adds_cors_headers_on_success():
    async def handler(request: Request) -> Response:
        return Response("OK", status_code=200)

    transport = httpx.ASGITransport(app=_make_app(handler))
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/test", headers={"Origin": "http://localhost:5173"})
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert r.headers.get("access-control-allow-methods") == "*"
    assert r.headers.get("access-control-allow-headers") == "*"


@pytest.mark.asyncio
async def test_existing_acao_header_not_overwritten():
    """If the inner response already sets ACAO, the middleware must not overwrite it."""

    async def handler(request: Request) -> Response:
        resp = Response("OK", status_code=200)
        resp.headers["Access-Control-Allow-Origin"] = "https://specific.origin"
        return resp

    transport = httpx.ASGITransport(app=_make_app(handler))
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/test", headers={"Origin": "http://localhost:5173"})
    assert r.headers.get("access-control-allow-origin") == "https://specific.origin"


# ---------------------------------------------------------------------------
# Exception-handling path (new in this PR)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_exception_in_handler_returns_500_json():
    async def failing_handler(request: Request) -> Response:
        raise RuntimeError("boom")

    transport = httpx.ASGITransport(app=_make_app(failing_handler))
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/test")
    assert r.status_code == 500
    assert r.json()["detail"] == "Internal Server Error"


@pytest.mark.asyncio
async def test_exception_with_origin_adds_cors_to_500():
    """A crash with an Origin header should still get CORS headers on the 500."""

    async def failing_handler(request: Request) -> Response:
        raise ValueError("unexpected")

    transport = httpx.ASGITransport(app=_make_app(failing_handler))
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/test", headers={"Origin": "http://frontend.local"})
    assert r.status_code == 500
    assert r.headers.get("access-control-allow-origin") == "http://frontend.local"


@pytest.mark.asyncio
async def test_exception_without_origin_no_cors_headers():
    async def failing_handler(request: Request) -> Response:
        raise ValueError("no origin scenario")

    transport = httpx.ASGITransport(app=_make_app(failing_handler))
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/test")
    assert r.status_code == 500
    assert "access-control-allow-origin" not in r.headers