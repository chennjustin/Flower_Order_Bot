# Backend Docs Index

這個資料夾集中管理後端文件。

## 文件清單

- `API_Reference.md`：API 規格與端點參考（英文，FastAPI）
- `ARCHITECTURE.md`：後端分層架構與開發規範
- `工單模板.docx`：DOCX 匯出模板（`/orders/{order_id}.docx` 預設使用；占位符為 catalog key，如 `{{ customer_name }}`）
- `order_template.docx`：舊版模板（保留參考；可設環境變數 `DOCX_TEMPLATE_FILE=order_template.docx` 切回）

## 文件路徑約定

- 所有後端設計、規格、流程說明文件統一放在 `backend/docs/`
- 避免將新的 `.md` 散落在 `backend/` 根目錄
- 匯出模板等文件資產（例如 `.docx`）也統一放在 `backend/docs/`