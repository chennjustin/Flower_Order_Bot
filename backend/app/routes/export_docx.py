import io
import os
from pathlib import Path

from docxtpl import DocxTemplate
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_store, get_order_for_store
from app.core.database import get_db
from app.models.store import Store
from app.services.message_service import get_chat_room_by_room_id
from app.services.order_field_config_service import get_effective_order_field_config
from app.services.order_field_values import build_docx_render_context_full_catalog
from app.services.order_service import get_order_out_by_id

api_router = APIRouter()
_DOCS_DIR = Path(__file__).resolve().parents[2] / "docs"
# Default staff work-order template (override via DOCX_TEMPLATE_FILE in .env).
_TEMPLATE_FILENAME = os.getenv("DOCX_TEMPLATE_FILE", "工單模板.docx")
TEMPLATE_PATH = _DOCS_DIR / _TEMPLATE_FILENAME


@api_router.get("/orders/{order_id}.docx")
async def export_order_docx(
    order_id: int,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    order_row = await get_order_for_store(db, order_id, store)

    order = await get_order_out_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    room = await get_chat_room_by_room_id(db, order_row.room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")

    field_config = await get_effective_order_field_config(db, room.store_id)
    context = build_docx_render_context_full_catalog(order, field_config.visible_fields)

    if not TEMPLATE_PATH.exists():
        raise HTTPException(status_code=500, detail="DOCX template not found")

    tpl = DocxTemplate(str(TEMPLATE_PATH))
    tpl.render(context)

    file_stream = io.BytesIO()
    tpl.save(file_stream)
    file_stream.seek(0)

    return StreamingResponse(
        file_stream,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename=order_{order_id}.docx"},
    )
