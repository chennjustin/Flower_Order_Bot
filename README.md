# Flourish — 花店訂單管理系統

Flourish 是以 LINE Bot 為接收端的花店商家後台系統。顧客透過 LINE 傳送訂購需求，系統以 OpenAI 將對話整理成結構化訂單草稿，商家確認後寫入資料庫，並可在後台查詢、匯出訂單、設定欄位，以及透過 LINE 自動傳送訂單確認卡片。

---

## 文件索引


| 文件                                                                                                                                    | 說明                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [完整安裝指南](docs/SETUP.md)                                                                                                               | 環境變數、資料庫 Migration、新增店家、LINE Webhook 設定                   |
| [API 文件](docs/CONTRACT.md)                                                                                                            | OpenAPI 契約                                              |
| [User Stories Mapping（Google Drive PDF）](https://drive.google.com/file/d/1FsLlntOHGPchPZe_HJmthVwnFEr8ttH9/view?usp=sharing)                  | 包含 Persona, User journey map 以及 User story map
| [Wireframes（Figma）](https://www.figma.com/design/ezUDW9FQcekL43jUONMyty/Flower_shop_platform?node-id=0-1&p=f&t=mnNPDy6pWtU5o5Hn-0) | 介面線框與 UI 原型                                             |
| [Database Schema](schema.png)                                                                                                         | 資料表結構與關聯（PostgreSQL / Supabase）                        |
| [Project Management（Notion）](https://ccloudd.notion.site/Flourish-362c3894a03a82b1bbcf01c455ee5d1b)                                 | 開發時程、任務分工、Milestones 報告 與 交付紀錄                                      |
| [測試報告](docs/TESTING.md)                                                                                                               | Unit / Integration / Contract / Smoke Test 說明           |


---

## 系統架構

```
┌──────────────────────────────────────────────────────────────────┐
│                         顧客端                                    │
│                     LINE App（手機）                              │
└───────────────────────────┬──────────────────────────────────────┘
                            │ 傳送訊息 / 接收卡片
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                   LINE Messaging API                              │
│             Webhook → POST /callback                              │
│             Push Message（Text / Flex Message）                   │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                 FastAPI Backend（Python 3.12）                    │
│                                                                  │
│   routes/ → services/ → repositories/                           │
│   ├─ linebot    ← LINE Webhook 解析、訊息存入 DB                  │
│   ├─ orders     ← 訂單 CRUD、草稿建立、匯出                       │
│   ├─ chat       ← 聊天室列表、SSE 推播端點                        │
│   └─ stores     ← 店家設定、欄位設定                              │
│                                                                  │
│   usecases/                                                      │
│   ├─ linebot_flow         ← Webhook 事件處理流程                  │
│   └─ organize_order_draft ← OpenAI 整理草稿流程                   │
│                                                                  │
│   SSE endpoint（/sse/stores/{id}）                               │
│   └─ Redis pub/sub → 跨 worker 廣播新訊息事件                    │
└──────────┬────────────────────────────────┬─────────────────────┘
           │ async SQLAlchemy               │ SSE stream
           ▼                               ▼
┌──────────────────────┐       ┌───────────────────────────────────┐
│  Supabase            │       │  React Frontend（TypeScript）     │
│  ├─ PostgreSQL       │       │                                   │
│  │  多租戶資料庫      │◄─────►│  MessagesPage — 三欄聊天室 RWD    │
│  │  store → customer │  REST │  OrdersPage   — 訂單管理          │
│  │  → chat_room      │  +SSE │  SettingsPage — 欄位設定          │
│  │  → order          │       │                                   │
│  └─ Auth             │       │  TanStack Query（server state）   │
│     Google OAuth     │       │  React Router（路由 / blocker）   │
│     JWT              │       │  Tailwind CSS                     │
└──────────────────────┘       └───────────────────────────────────┘

┌──────────────────────┐
│  Redis               │
│  SSE pub/sub channel │
│  支援多個 uvicorn     │
│  worker 同步推播      │
└──────────────────────┘
```

---

## Tech Stack


| 層級   | 技術                                                                   |
| ---- | -------------------------------------------------------------------- |
| 前端   | React 19、TypeScript、Vite、TanStack Query、React Router v6、Tailwind CSS |
| 後端   | Python 3.12、FastAPI、SQLAlchemy 2.x async、Alembic、Pydantic v2         |
| 資料庫  | PostgreSQL（Supabase 托管）、Redis                                        |
| AI   | OpenAI GPT（訂單草稿整理）                                                   |
| 通訊   | LINE Messaging API SDK（Webhook、Push Message、Flex Message）            |
| 認證   | Supabase Auth（Google OAuth）、JWT                                      |
| 部署   | Docker Compose                                                       |
| 文件匯出 | DOCX（python-docxtpl）、CSV（前端產生）                                       |


---

## 架構設計說明

### 即時通訊：SSE + Redis pub/sub

LINE Webhook 收到新訊息後，後端透過 Redis publish 事件；所有連線中的前端 SSE client 透過 subscribe 立即收到推播。這樣即使部署多個 uvicorn worker，任何 worker 收到 Webhook 都能廣播給連到其他 worker 的前端，不需要 sticky session。

相較 WebSocket，SSE 是單向推播、瀏覽器自動重連，更適合「後端主動通知」的使用場景，且前端無需額外函式庫。

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

前端收到 changed_fields → 藍色高亮顯示 AI 填入的欄位值
```

### 多使用者資料隔離

所有 repository 方法強制帶入 `store_id`，Repository 層統一過濾，防止跨店資料洩漏。

訂單查詢使用 `outerjoin + OR` 設計，同時支援兩種來源：從聊天室草稿建立的訂單（有 `room_id`）與後台直接新增的訂單（`room_id = NULL`）。

### 動態欄位設定

`store_order_field_config` 表以 JSONB 儲存每家店的欄位顯示設定（顯示/隱藏/順序）。前端草稿表單、訂單列表欄位、LINE Flex Message 卡片內容均讀取此設定動態渲染，商家調整後立即生效，不需改程式碼。

---

## 功能說明

### 聊天室

- 三欄 RWD 介面（聊天室列表 / 對話 / 訂單詳情）
- SSE 即時推播新訊息（透過 Redis 跨 worker 廣播）
- AI 整理草稿：從 LINE 對話自動提取訂單欄位，藍色高亮顯示 AI 填入的值
- 建立訂單後自動 push LINE Flex Message 訂單確認卡片給顧客

### 訂單管理

- 列表、篩選（狀態 / 日期 / 關鍵字）、分頁
- 直接新增訂單 / 從草稿建立訂單
- 匯出 DOCX 工單（Word 模板）、CSV

### 欄位設定

- 每家店獨立設定，拖曳調整顯示順序
- 切換欄位顯示 / 隱藏（必要欄位鎖定）
- 欄位設定影響草稿表單、訂單列表、Flex Message 卡片內容

### 認證

- Google OAuth 登入（Supabase Auth）
- 店主與 store 1:1 綁定，僅能存取自己店的資料
- Onboarding 流程（首次登入引導設定店名與欄位）

---

## 快速開始

```bash
git clone <repository-url>
cd Flower_Order_Bot

cp backend/.env.example backend/.env
# 填入 DATABASE_URL、OPENAI_API_KEY、LINE token/secret、SUPABASE_URL/KEY

docker compose up --build
```

- 前端：`http://localhost:5173`
- 後端 Swagger：`http://localhost:8000/docs`

完整安裝步驟（本機執行、ngrok、資料庫 migration、新增店家）見 [docs/SETUP.md](docs/SETUP.md)。

---

## Testing

本專案涵蓋 **Unit Test**、**Integration Test**、**Contract Test** 與 **Smoke Test**，完整說明見 [docs/TESTING.md](docs/TESTING.md)。


| 範圍       | 框架     | 測試檔 | 案例數 | 最近結果（2026-06-12） |
| -------- | ------ | --- | --- | ---------------- |
| Backend  | pytest | 39  | 206 | 206 passed       |
| Frontend | Vitest | 5   | 18  | 18 passed        |


> 自行執行測試前，請先依 [docs/SETUP.md](docs/SETUP.md) 完成環境變數、資料庫與認證設定。

```bash
# Backend
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v

# Frontend
cd frontend
npm install
npx vitest run
```

---

## 授權

[MIT License](LICENSE)