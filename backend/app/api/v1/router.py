"""Top-level API router for v1."""

from fastapi import APIRouter

from app.routes.export_docx import api_router as export_docx_router
from app.routes.generate_fake_data import api_router as generate_fake_data_router
from app.routes.health import router as health_router
from app.routes.linebot import api_router as linebot_router
from app.routes.messages import api_router as messages_router
from app.routes.orders import api_router as orders_router
from app.routes.organize_data import api_router as organize_data_router
from app.routes.payment import api_router as payment_router
from app.routes.statistics import api_router as stats_router
from app.routes.store_display import api_router as store_display_router

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
api_router.include_router(store_display_router, tags=["Store Display"])

