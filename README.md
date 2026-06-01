# ChiMei Floral

本專案為花店商家後台：透過 LINE Bot 接收顧客訊息，以 OpenAI 將對話整理成結構化訂單草稿；商家確認後寫入訂單資料庫，並在 `/orders` 查詢。CSV 由前端在瀏覽器產生下載，DOCX 工單由後端提供。

**目前分支（`refactor/db`）** 已改為 **多租戶 schema**（`store` → `customer` → `chat_room` / `order`），主資料庫建議使用 **Supabase PostgreSQL**；Docker Compose **不再**內建本機 Postgres 容器。

---

## ✅ 已實作功能

- ✅ LINE Bot 接收訊息、儲存對話與貼圖
- ✅ GPT 將對話轉為結構化訂單草稿（關鍵字觸發）
- ✅ **PostgreSQL**（開發／部署以 Supabase 或自備 Postgres 為主）
- ✅ 管理訂單、顧客（`customer`）與聊天紀錄
- ✅ `/orders` 查詢、CSV（前端）、DOCX 工單（後端）
- ✅ 前端 **React + TypeScript + Vite**
- ✅ **Alembic** 資料庫版本控制

---

## 📁 目錄

- [系統需求](#系統需求)
- [安裝與設定](#安裝與設定)
- [環境變數](#環境變數)
- [資料庫與店家（store）](#資料庫與店家store)
- [執行應用程式](#執行應用程式)
- [Webhook 配置](#webhook-配置)
- [API 契約守門](#api-契約守門)
- [程式架構](#程式架構)
- [授權](#授權)

---

## ⚙️ 系統需求

- 作業系統：macOS / Linux / Windows
- Python：3.12+（建議與 `backend/Dockerfile` 一致）
- Node.js：22+（Vite 8 需 20.19+ 或 22.12+）
- **Docker Desktop**（選用）：一鍵跑前後端容器；資料庫仍連 Supabase
- **Supabase**（或相容的 PostgreSQL）：專案連線字串寫在 `backend/.env`

---

## 🧰 安裝與設定

### 1. 複製專案

```bash
git clone <repository-url>
cd <repository-folder>
```

### 2. 後端虛擬環境

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 前端依賴

```bash
cd frontend
npm install
```

### 4. 環境變數

```bash
cp backend/.env.example backend/.env
```

編輯 `backend/.env`，至少設定：

| 變數 | 說明 |
|------|------|
| `DATABASE_URL` | 非同步連線（`postgresql+asyncpg://...`，Supabase 請用 `ssl=require`） |
| `DATABASE_ALEM_URL` | Alembic 用（`postgresql+psycopg2://...`，常用 `sslmode=require`） |
| `OPENAI_API_KEY` | OpenAI |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` | LINE Bot |
| `PUBLIC_BASE_URL` | 對外可連的後端基底網址（本機 `http://localhost:8000`；ngrok 請改 https） |

連線組裝邏輯見 `backend/app/core/settings.py`（若已設 `DATABASE_URL` 則優先於舊版 `POSTGRES_*`）。

金鑰來源：[OpenAI](https://platform.openai.com/account/api-keys)、[LINE Developers](https://developers.line.biz/console/)。

---

## 資料庫與店家（store）

### Schema 與遷移

- 多租戶表：`store`、`customer`、`chat_room`、`chat_message`、`order`、`order_draft`、`payment`、`payment_method`、`notification` 等。
- 破壞性遷移 **`f4e8bb2a9031`** 會 DROP 舊表後重建，**僅適合新庫或願意清空資料時**執行。
- 套用遷移（在 `backend`、已啟用 venv）：

```bash
cd backend
alembic upgrade head
```

- Docker 啟動時預設 **`SKIP_ALEMBIC_ON_START=1`**（不自動跑 Alembic），請在 Supabase 上自行確認 revision 或手動執行上述指令。

### 是否有「預設店家」？

程式**沒有** `default_store` 欄位或設定檔。新 LINE 顧客會掛到 **`store` 表中 `id` 最小的一筆**（`get_first_store_id()`）。

因此開發／測試前，資料庫裡**至少要有一筆 `store`**。若沒有，種子資料與 LINE 建立顧客會失敗（例如：`資料庫中沒有 store，請先在 Supabase 建立店家資料。`）。

在 Supabase SQL Editor 可手動插入（`owner_auth_user_id` 請改成你的 Supabase Auth UUID，或開發用固定 UUID）：

```sql
INSERT INTO public.store (name, slug, timezone, active, created_at, updated_at, owner_auth_user_id)
VALUES (
  '開發用店家',
  'dev-local',
  'Asia/Taipei',
  true,
  NOW(),
  NOW(),
  '00000000-0000-4000-8000-000000000001'::uuid
);
```

**你目前的 Supabase（已連線驗證）**：Alembic `f4e8bb2a9031`，已有 **1 筆 store**（`id=1`，`slug=dev-local`），以及測試用 customer / chat_room / order 等資料；LINE 新用戶會歸到這家店。

### 測試資料

```bash
cd backend
PYTHONPATH=. python app/seeds/seed_all.py
```

或後端啟動後：`GET http://localhost:8000/generate-fake-data?count=10`（需 DB 內已有 store）。

### 舊版本機 Docker Postgres

若仍要連過去 compose 裡的 `db` 容器，請在 `.env` 取消註解 `POSTGRES_*` 並自行調整 `docker-compose`；**目前預設流程以 Supabase 為準**，根目錄 `docker-compose.yml` 已不含 `db` 服務。

---

## 🚀 執行應用程式

### 模式 A：本機跑前後端（連 Supabase）

1. 確認 `backend/.env` 的 `DATABASE_URL` / `DATABASE_ALEM_URL` 正確，且 Supabase 上 schema 與 Alembic head 一致。
2. 後端（**工作目錄必須是 `backend`**）：

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

3. 前端：

```bash
cd frontend
npm run dev
```

4. 網址：
   - 前端：`http://localhost:5173`
   - 後端 API / Swagger：`http://localhost:8000`

修改 `.env` 後請重啟 uvicorn。

### 模式 B：Docker Compose（backend + frontend）

```bash
# 專案根目錄；第一次或 Dockerfile 有變更
docker compose up --build

# 日常
docker compose up
```

- 資料庫：讀取 `backend/.env` 的 Supabase，**不會**啟動本機 Postgres。
- `backend`、`frontend` 掛載 volume，支援 `--reload` / Vite HMR。
- 關閉：`docker compose down`

服務位址與模式 A 相同（5173 / 8000）。

### 本機對外 Webhook（LINE）

```bash
ngrok http 8000
```

將 LINE Webhook 指到 `https://<ngrok-id>.ngrok.io/callback`，並把 `PUBLIC_BASE_URL` 改成對應的 https 基底（圖片 URL 用）。

---

## 🔗 Webhook 配置

於 [LINE Developers Console](https://developers.line.biz/console/) 設定 Webhook URL，例如：

```text
https://your-domain.example.com/callback
```

本機除錯請配合 ngrok；開發用重置指令可設 `LINE_TEST_RESET_PHRASE`（傳入完全相同文字會刪除該聊天室與顧客相關資料）。

---

## ✅ API 契約守門

重構期間以 `docs/CONTRACT.md` 為基線：

```bash
cd backend
make contract-check
```

可連測試庫時建議：

```bash
cd backend
pytest tests/test_contract_smoke.py
```

---

## 🧠 程式架構

### `backend/app/`（FastAPI）

| 目錄 | 說明 |
|------|------|
| `main.py` | 應用入口、CORS、靜態 uploads |
| `api/v1/` | API 路由聚合 |
| `models/` | ORM：`Store`、`Customer`、`ChatRoom`、`Order` 等 |
| `routes/` | HTTP 路由（linebot、orders、chat、payment…） |
| `services/` | 業務邏輯 |
| `repositories/` | 資料存取（含 `get_first_store_id`） |
| `schemas/` | Pydantic 請求／回應；`User` 為 `Customer` 的相容別名 |
| `core/` | 設定、DB session |
| `seeds/` | 假資料產生 |

### `frontend/`（React + TypeScript）

- Vite、TanStack Query、React Router（`/`、`/orders`、`/messages`、`/stats`）
- `frontend/.env`：`VITE_API_BASE_URL`（預設 `http://localhost:8000`）

### 重構後手動 smoke

- 首頁訂單表與統計可載入；刪除訂單後列表刷新。
- `Messages`：切換聊天室、送訊、右側草稿面板、「更新／建立工單」。
- DOCX 下載、CSV 瀏覽器下載。
- `docker compose up` 下 5173 / 8000 行為與本機模式一致。

---

## 📄 授權

[MIT License](LICENSE)
