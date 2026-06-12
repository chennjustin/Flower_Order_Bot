# 測試報告

此專案涵蓋 **Unit Test**、**Integration Test**、**Contract Test** 與 **Smoke Test**，分別驗證流程、API 行為、前後端契約一致性，以及 endpoint 是否可用。

**最後執行日期：** 2026-06-12

---

## 測試總覽


| 範圍       | 框架     | 測試檔數   | 測試案例數   | 結果             |
| -------- | ------ | ------ | ------- | -------------- |
| Backend  | pytest | 39     | 206     | **206 passed** |
| Frontend | Vitest | 5      | 18      | **18 passed**  |
| **合計**   | —      | **44** | **224** | **224 passed** |


---

## 測試類型說明


| 類型                     | 數量（Backend 檔案） | 說明                                                                                        |
| ---------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| **Unit Test**          | 30             | 驗證 service、repository、usecase、ORM model 等單一模組，使用 mock / monkeypatch                       |
| **Integration Test**   | 5              | 透過 `httpx.ASGITransport` 對 FastAPI ASGI app 發送 HTTP 請求，驗證路由、middleware、auth、store context |
| **Contract Test**      | 3              | 維護 OpenAPI spec 與前後端的 `ORDER_FIELD_REGISTRY` catalog 一致                                   |
| **Smoke Test**         | 2              | 快速確認 `/health` 與核心 API 端點可回應                                                              |
| **Frontend Unit Test** | 5              | 驗證欄位設定、React Query cache key、CSV 格式化等純函式                                                  |


---

## 如何執行

### Backend（pytest）

```bash
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v
```

### Frontend（Vitest）

```bash
cd frontend
npm install
npx vitest run
```

---

## 執行結果詳情

### Backend — 206 / 206 passed ✅


| 類別                         | 測試檔                                      | 案例數 |
| -------------------------- | ---------------------------------------- | --- |
| LLM Delta 解析               | `test_llm_order_delta.py`                | 15  |
| ORM Model 結構               | `test_models_pr_changes.py`              | 33  |
| Order Field Config         | `test_order_field_config_service.py`     | 13  |
| Store Context              | `test_store_context.py`                  | 11  |
| Chat Enum                  | `test_enums_chat_pr.py`                  | 12  |
| Order Field Values / DOCX  | `test_order_field_values.py`             | 8   |
| CORS Middleware            | `test_middleware_cors_pr.py`             | 6   |
| Catalog Alignment          | `test_order_fields_catalog_alignment.py` | 6   |
| Chat Image Storage         | `test_chat_image_storage.py`             | 6   |
| Get Order for Store        | `test_get_order_for_store.py`            | 6   |
| Settings URL               | `test_settings_url_fix_pr.py`            | 6   |
| LINE Bot Welcome Flow      | `test_linebot_welcome_flow.py`           | 7   |
| User Alias / Shipment      | `test_user_alias_and_shipment_pr.py`     | 9   |
| Organize Draft Usecase     | `test_usecase_parse_order_draft.py`      | 3   |
| 其餘 Unit / Integration Test | 見下方完整清單                                  | —   |


### Frontend — 18 / 18 passed ✅


| 測試檔                                  | 案例數 | 驗證重點                                     |
| ------------------------------------ | --- | ---------------------------------------- |
| `config/orderDisplayFields.test.ts`  | 3   | 預設欄位 config（全可見、順序、`order_id` 鎖定）        |
| `lib/orderFieldPresentation.test.ts` | 8   | Table column、CSV 格式化、Draft field 可見性     |
| `lib/orderDisplayFromApi.test.ts`    | 4   | API response → local display config 轉換   |
| `lib/llmChangedFields.test.ts`       | 2   | LLM `changed_fields` key → `FieldKey` 映射 |
| `lib/storeQueryKeys.test.ts`         | 1   | React Query cache key 按 `store_id` 隔離    |


---

## Backend 測試檔完整清單

### Integration Test（5 檔 · 20 case）


| 測試檔                                 | 案例數 | 驗證內容                                                                           |
| ----------------------------------- | --- | ------------------------------------------------------------------------------ |
| `test_store_scoped_api.py`          | 5   | 多店 API 隔離：`/orders`、`/chat_rooms`、`/stats` 需 `X-Store-Id`；路徑 store id 不一致回 403 |
| `test_stores_me.py`                 | 2   | `GET /stores/me` 需 JWT 認證，回傳綁定 store                                           |
| `test_middleware_cors_pr.py`        | 6   | CORS middleware：Origin header 附加、exception 時仍帶 CORS                            |
| `test_organize_order_draft_flow.py` | 2   | AI organize 端到端：草稿寫入、Customer phone 同步、缺漏提醒                                    |
| `test_contract_smoke.py`            | 1   | 核心端點 smoke：`/health`、`/orders`、`/stats`、`/stores`、`/payment_methods`           |


### Contract Test（3 檔 · 11 case）


| 測試檔                                      | 案例數 | 驗證內容                                               |
| ---------------------------------------- | --- | -------------------------------------------------- |
| `test_openapi_contract.py`               | 2   | Swagger UI 可存取；OpenAPI spec 包含 frozen core paths   |
| `test_order_fields_catalog_alignment.py` | 6   | 前後端 `ORDER_FIELD_REGISTRY` 標籤、key 分區、預設順序一致        |
| `test_multi_store_docx_and_config.py`    | 3   | `display_config` JSON 形狀；DOCX render context 欄位完整性 |


### Smoke Test（1 檔 · 1 case）


| 測試檔              | 案例數 | 驗證內容                |
| ---------------- | --- | ------------------- |
| `test_health.py` | 1   | `GET /health` 回 200 |


### Unit Test（30 檔 · 174 case）


| 測試檔                                         | 案例數 | 驗證內容                                                             |
| ------------------------------------------- | --- | ---------------------------------------------------------------- |
| `test_llm_order_delta.py`                   | 15  | LLM delta JSON 解析、phone 正規化、`changed_fields` 計算、visible field 過濾 |
| `test_models_pr_changes.py`                 | 33  | 多租戶 ORM 結構：`Store`、`Customer`、`ChatRoom`、`Order`、`OrderDraft` 等  |
| `test_order_field_config_service.py`        | 13  | 欄位 visible / field_order / organize_required 設定服務                |
| `test_store_context.py`                     | 11  | `X-Store-Id` header / query 解析、路徑比對、400 / 404 處理                 |
| `test_enums_chat_pr.py`                     | 12  | `ChatMessageDirection` enum 成員與正規化                               |
| `test_order_field_values.py`                | 8   | 欄位格式化、DOCX legacy / catalog render context                       |
| `test_get_order_for_store.py`               | 6   | 跨店 order 存取拒絕（direct order / chat order）                         |
| `test_chat_image_storage.py`                | 6   | Supabase Storage 上傳路徑、JWT 簽發                                     |
| `test_linebot_welcome_flow.py`              | 7   | LINE Bot welcome stage、7 天重置、follow event                        |
| `test_user_alias_and_shipment_pr.py`        | 9   | `User` = `Customer` alias、`ShipmentMethod` enum                  |
| `test_settings_url_fix_pr.py`               | 6   | `DATABASE_URL` sslmode → asyncpg 轉換                              |
| `test_order_service_update_draft_guard.py`  | 4   | Draft 更新守衛：customer phone 變更、null 清空                             |
| `test_order_pagination.py`                  | 4   | Order list 狀態篩選、分頁 response shape                                |
| `test_multi_store_line.py`                  | 4   | LINE webhook `destination` → store 解析                            |
| `test_json_extract.py`                      | 4   | 從 LLM response 提取 JSON（plain / markdown fence / embedded）        |
| `test_order_service_update_order_fields.py` | 3   | Order 欄位更新：nullable 清空、not-null 保護                               |
| `test_order_service_validation.py`          | 3   | Draft 必填欄位校驗（core / catalog / optional required）                 |
| `test_order_service_orders_by_room.py`      | 3   | `GET /orders/room/{room_id}` service 層邏輯                         |
| `test_suggest_order_from_chat.py`           | 3   | Chat suggest：LLM patch merge、`changed_fields`                    |
| `test_order_list_filters_tz.py`             | 3   | Pickup time 篩選：UTC → Asia/Taipei 轉換                              |
| `test_order_draft_field_validation.py`      | 3   | Catalog value 空值判斷、missing label 收集                              |
| `test_store_provision.py`                   | 3   | Store provision script：email 正規化、LINE bot ID                     |
| `test_usecase_parse_order_draft.py`         | 3   | Organize draft visible field 過濾                                  |
| `test_chat_room_pagination.py`              | 2   | Chat room list stage / search 篩選、`has_more` 分頁                   |
| `test_customer_organize_sync.py`            | 2   | Organize 時 Customer phone 同步                                     |
| `test_display_config_migration.py`          | 2   | `display_config` 預設順序與自訂順序保留                                     |
| `test_order_status_update.py`               | 2   | Order status 更新、not found 處理                                     |
| `test_organize_order_draft.py`              | 1   | 無 chat message 時跳過 OpenAI 呼叫                                     |
| `test_orders_repository_store_scope.py`     | 1   | Repository 查詢傳遞 `store_id`                                       |
| `test_stats_repository_today_orders.py`     | 1   | 今日訂單統計排除 `CANCELLED`                                             |


---

## 測試覆蓋的核心業務流程

```
顧客 LINE 訊息
  → LINE Bot Welcome Flow          (test_linebot_welcome_flow)
  → AI Organize Draft              (test_organize_order_draft_flow, test_llm_order_delta)
  → Draft 欄位校驗                  (test_order_service_validation)
  → 建立正式 Order                  (test_order_status_update)
  → 多店 Store 隔離查詢              (test_store_scoped_api, test_get_order_for_store)
  → DOCX / CSV 欄位渲染             (test_order_field_values, orderFieldPresentation.test)
  → 前後端 Catalog 一致性            (test_order_fields_catalog_alignment)
```

---

## 環境設定

執行測試時，請先完成以下環境設定，否則部分 **Integration Test** 可能因連線或認證未就緒而無法通過：

1. **安裝依賴**：`pip install -r backend/requirements.txt`、`npm install`（frontend）
2. **環境變數**：依 [docs/SETUP.md](SETUP.md) 設定 `backend/.env`（`DATABASE_URL`、`SUPABASE_URL`、`OPENAI_API_KEY` 等）
3. **資料庫連線**：PostgreSQL（Supabase）需可連線；部分 Integration Test 需有效的 store 資料
4. **認證設定**：Integration Test 的 `/orders`、`/stores/me` 等 endpoint，需正確設定 Supabase Auth / JWT
5. **Redis**：SSE 相關功能測試需 Redis 可連線

完整安裝步驟見 [docs/SETUP.md](SETUP.md)。