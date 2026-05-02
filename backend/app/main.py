from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.api.v1.router import api_router

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
app.include_router(api_router)
# === 本地啟動指令 =======================================================
# uvicorn app.main:app --reload --port 8000
