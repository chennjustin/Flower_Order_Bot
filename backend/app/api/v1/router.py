"""Top-level API router for v1."""

from fastapi import APIRouter

from app.api.v1.endpoints.export_docx import router as export_docx_router
from app.api.v1.endpoints.generate_fake_data import router as generate_fake_data_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.linebot import router as linebot_router
from app.api.v1.endpoints.messages import router as messages_router
from app.api.v1.endpoints.orders import router as orders_router
from app.api.v1.endpoints.organize_data import router as organize_data_router
from app.api.v1.endpoints.payment import router as payment_router
from app.api.v1.endpoints.statistics import router as stats_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["Health"])
api_router.include_router(orders_router, tags=["Orders"])
api_router.include_router(export_docx_router, tags=["Orders"])
api_router.include_router(organize_data_router, tags=["Organize Data"])
api_router.include_router(messages_router, tags=["Chat"])
api_router.include_router(stats_router, tags=["Statistics"])
api_router.include_router(payment_router, tags=["Payment"])
api_router.include_router(linebot_router, tags=["LINE Bot Reply Messages"])
api_router.include_router(generate_fake_data_router, tags=["Generate Fake Data"])

