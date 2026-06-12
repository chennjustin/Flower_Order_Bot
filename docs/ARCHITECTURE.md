# 技術架構說明

## 系統架構圖

```
┌─────────────────────────────────────────────────────────────────────┐
│                          顧客端                                      │
│                      LINE App（手機）                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │ 傳送訊息 / 接收卡片
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LINE Messaging API                                │
│              Webhook → POST /callback                                │
│              Push Message（Text / Flex Message）                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend（Python 3.12）                    │
│                                                                     │
│  routes/        services/          usecases/                        │
│  ├─ linebot  →  message_service  → linebot_flow                     │
│  ├─ orders   →  order_service    → organize_order_draft             │
│  ├─ chat     →  chat_service       （OpenAI API 呼叫）              │
│  └─ stores   →  user_service                                        │
│                                                                     │
│  SSE endpoint（/sse/stores/{id}）                                   │
│  └─ Redis pub/sub → 跨 worker 廣播新訊息事件                        │
└──────────┬───────────────────────────────────┬──────────────────────┘
           │  async SQLAlchemy                 │  SSE stream
           ▼                                  ▼
┌──────────────────────┐          ┌───────────────────────────────────┐
│  Supabase            │          │  React Frontend（TypeScript）     │
│  ├─ PostgreSQL       │          │                                   │
│  │  (多租戶資料庫)   │◄────────►│  pages/   hooks/   components/    │
│  └─ Auth             │  REST    │  ├─ MessagesPage（三欄聊天室）     │
│     Google OAuth     │  + SSE   │  ├─ OrdersPage（訂單管理）        │
│     JWT              │          │  └─ SettingsPage（欄位設定）      │
└──────────────────────┘          │                                   │
                                  │  TanStack Query（server state）   │
┌──────────────────────┐          │  React Router（路由 / blocker）   │
│  Redis               │          │  Tailwind CSS（樣式）             │
│  SSE pub/sub channel │          └───────────────────────────────────┘
│  跨多個 uvicorn       │
│  worker 同步         │
└──────────────────────┘
```

---

## Tech Stack 選型說明

### 後端：FastAPI + SQLAlchemy async

FastAPI 內建 async/await 支援，對 SSE（Server-Sent Events）長連線友好；相較 Django/Flask，不需要額外的 ASGI adapter。SQLAlchemy 2.x async ORM 讓資料庫操作非阻塞，可在同一個 event loop 裡同時處理多條 SSE 長連線與 Webhook 請求。

Pydantic v2 作為資料驗證層，搭配 FastAPI 自動產生 OpenAPI 文件，前後端 schema 始終對齊。

### 前端：React + TanStack Query

TanStack Query 負責 server state（API 快取、失效、背景重新抓取），讓聊天室、訂單列表等頁面的資料同步邏輯集中在 hooks 層，元件只做 UI 渲染。

`useBlocker`（React Router v6.13+）用於攔截未儲存的表單跳頁，避免店家意外丟失訂單草稿編輯。

### 即時通訊：SSE + Redis pub/sub

LINE Webhook 收到訊息後，後端透過 Redis publish 事件；所有連線中的 SSE client 透過 subscribe 收到後立即推送給前端。這樣即使部署多個 uvicorn worker，任何 worker 收到 Webhook 都能廣播給連到其他 worker 的前端。

相較 WebSocket，SSE 是單向推播、自動重連，更適合「後端主動通知」這個使用場景，瀏覽器原生支援無需額外函式庫。

### 認證：Supabase Auth

Supabase Auth 處理 Google OAuth 流程，核發 JWT 後前端直接帶 Bearer token 呼叫 FastAPI；後端透過 `auth.get_user(token)` 驗證，不需要自建 session 或 refresh token 邏輯。

每個 store 在資料庫有 `owner_email` 欄位，Google 帳號登入後自動與對應 store 綁定，實現多租戶隔離。

### 資料庫：PostgreSQL（Supabase 托管）

多租戶資料模型：`store → customer → chat_room → order`，所有查詢強制帶 `store_id` 過濾，Repository 層統一實作，防止跨店資料洩漏。

`store_order_field_config` 表以 JSONB 欄位儲存每家店的欄位顯示設定（顯示/隱藏/順序），無需為每家店改資料庫 schema。

### 文件匯出：python-docxtpl

商家可匯出工單為 Word 檔（.docx），使用 Word 模板（`.docx` 內嵌 Jinja2 標籤），讓非技術使用者自訂工單版型，不需要改程式碼。

---

## 核心功能技術說明

### AI 整理草稿流程

```
商家按「整理草稿」
      │
      ▼
PATCH /organize_data/{room_id}
      │
      ▼
organize_order_draft usecase
      ├─ 1. 取出該聊天室最近 N 則訊息
      ├─ 2. 組成 prompt（含欄位 schema）送 OpenAI Chat Completion
      ├─ 3. 解析回傳 JSON → 寫入 order_draft 表
      └─ 4. 回傳 changed_fields（哪些欄位被 AI 填入）
      
前端收到 changed_fields
      └─ 以藍色高亮顯示 AI 填入的欄位值
         讓商家一眼識別 AI 推斷 vs 原有資料
```

Prompt 設計：system prompt 說明欄位清單與格式要求；user message 為聊天記錄文字；要求回傳固定 JSON schema，以 Pydantic 驗證後寫入。

### LINE Flex Message 訂單確認

建立訂單成功後，後端讀取該 store 的 `store_order_field_config`，只取 `visible=true` 的欄位，動態組裝 Flex Message BubbleContainer，push 給顧客的 LINE。

這樣不同商家自訂欄位設定後，顧客收到的訂單確認卡片也會對應調整，不需要寫死欄位清單。

### 多租戶資料隔離

```python
# 所有 repository 方法強制帶入 store_id
async def list_orders_filtered(session, filters: OrderListFilters):
    stmt = select(Order).outerjoin(ChatRoom, Order.room_id == ChatRoom.id).where(
        or_(
            ChatRoom.store_id == filters.store_id,
            Order.store_id == filters.store_id,   # 直接建立的訂單（無聊天室）
        )
    ).distinct()
```

`outerjoin` + `OR` 設計支援兩種訂單來源：從聊天室草稿建立（有 `room_id`），與後台直接新增（`room_id=NULL`），兩者都能正確過濾到正確 store。

---

## 目錄結構

### `backend/app/`

| 目錄 | 職責 |
|------|------|
| `routes/` | HTTP 路由定義（linebot、orders、chat、stores、payment、stats） |
| `services/` | 業務邏輯（order、message、user、calendar） |
| `repositories/` | 資料存取層，封裝所有 SQLAlchemy 查詢 |
| `models/` | ORM 模型（Store、Customer、ChatRoom、Order、OrderDraft、Message） |
| `schemas/` | Pydantic request / response schema |
| `usecases/` | 跨服務流程（linebot_flow、organize_order_draft） |
| `core/` | 設定、DB session factory、JWT 認證 middleware |
| `utils/` | LINE 訊息發送（文字、Flex Message）、datetime 工具 |
| `seeds/` | 開發用測試資料 |
| `config/` | 店家 provision 設定檔 |

### `frontend/src/`

| 目錄 | 職責 |
|------|------|
| `pages/` | 頁面元件（MessagesPage、OrdersPage、DashboardPage、StatsPage、SettingsPage） |
| `components/` | UI 元件（messages/、orders/、orderFields/、layout/） |
| `hooks/` | TanStack Query hooks（useOrders、useChatRooms、useRoomOrders…） |
| `contexts/` | React Context（AuthContext、StoreContext、OrderDisplayConfigContext） |
| `api/` | API client 函式（型別安全的 fetch wrapper） |
| `config/` | 欄位 catalog（所有可用訂單欄位定義）、表單設定 |
| `lib/` | 工具函式（欄位呈現、AI highlight、欄位寬度設定） |
| `types/` | TypeScript domain / enum 型別 |
| `utils/` | datetime、orderStatus 格式化 |
