from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.routes.health import router as health_router
from app.routes.orders import api_router as orders_router
from app.routes.statistics import api_router as stats_router
from app.routes.messages import api_router as messages_router
from app.routes.payment import api_router as payment_router
from app.routes.linebot import api_router as linebot_router
from app.routes.export_docx import api_router as export_docx_router
from app.routes.generate_fake_data import api_router as generate_fake_data_router
from app.routes.organize_data import api_router as organize_data_router

app = FastAPI(
    title="花店自動化系統 API Dashboard",
    docs_url="/",  # Swagger UI 路徑
)


class EnsureCorsHeadersMiddleware(BaseHTTPMiddleware):
    """
    未捕捉例外時內層回應常沒有 CORS 頭，瀏覽器會只報 CORS 而看不到真正錯誤。
    在回應缺少 ACAO 時補上（僅當請求帶 Origin，例如前端 dev server）。
    """

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        origin = request.headers.get("origin")
        if not origin:
            return response
        if any(k.lower() == "access-control-allow-origin" for k in response.headers.keys()):
            return response
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response


# 後註冊者包在外層：最後註冊的 Ensure 會最先收到請求、最後送出回應，可補齊錯誤回應的 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(EnsureCorsHeadersMiddleware)

# === 將 APIRouter 掛進來 =================================================
app.include_router(health_router, tags=["Health"])
app.include_router(orders_router, tags=["Orders"])
app.include_router(export_docx_router, tags=["Orders"])
app.include_router(organize_data_router, tags=["Organize Data"])
app.include_router(messages_router, tags=["Chat"])
app.include_router(stats_router,   tags=["Statistics"])
app.include_router(payment_router, tags=["Payment"])
app.include_router(linebot_router, tags=["LINE Bot Reply Messages"])
app.include_router(generate_fake_data_router, tags=["Generate Fake Data"])
# === 本地啟動指令 =======================================================
# uvicorn app.main:app --reload --port 8000
