# **Flourish**

本專案為花店商家後台：透過 LINE Bot 接收顧客訊息，以 OpenAI 將對話整理成結構化訂單草稿；商家確認後寫入訂單資料庫，並在 `/orders` 查詢。CSV 由前端在瀏覽器產生下載，DOCX 訂單由後端提供。

**目前分支（`refactor/db`）** 已改為 **多租戶 schema**（`store` → `customer` → `chat_room` / `order`），主資料庫建議使用 **Supabase PostgreSQL**；Docker Compose **不再**內建本機 Postgres 容器。

---

## ✅ 已實作功能

- ✅ LINE Bot 接收訊息、儲存對話與貼圖
- ✅ GPT 將對話轉為結構化訂單草稿（關鍵字觸發）
- ✅ **PostgreSQL**（開發／部署以 Supabase 或自備 Postgres 為主）
- ✅ 管理訂單、顧客（`customer`）與聊天紀錄
- ✅ `/orders` 查詢、CSV（前端）、DOCX 訂單（後端）
- ✅ 前端 **React + TypeScript + Vite**
- ✅ **Alembic** 資料庫版本控制

---

## 📁 目錄

- [系統需求](#系統需求)
- [安裝與設定](#安裝與設定)
- [環境變數](#環境變數)
- [資料庫與店家（store）](#資料庫與店家store)
- [多店後台 API 與欄位設定](#多店後台-api-與欄位設定)
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


| 變數                                                  | 說明                                                          |
| --------------------------------------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`                                      | 非同步連線（`postgresql+asyncpg://...`，Supabase 請用 `ssl=require`） |
| `DATABASE_ALEM_URL`                                 | Alembic 用（`postgresql+psycopg2://...`，常用 `sslmode=require`） |
| `OPENAI_API_KEY`                                    | OpenAI                                                      |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` | LINE Bot                                                    |
| `PUBLIC_BASE_URL`                                   | 對外可連的後端基底網址（本機 `http://localhost:8000`；ngrok 請改 https）      |


連線組裝邏輯見 `backend/app/core/settings.py`（若已設 `DATABASE_URL` 則優先於舊版 `POSTGRES_*`）。

金鑰來源：[OpenAI](https://platform.openai.com/account/api-keys)、[LINE Developers](https://developers.line.biz/console/)。

---

## 資料庫與店家（store）

### Schema 與遷移

- 多租戶表：`store`、`customer`、`chat_room`、`chat_message`、`order`、`order_draft`、`payment`、`payment_method`、`notification` 等。
- 破壞性遷移 **`f4e8bb2a9031`** 會 DROP 舊表後重建，**僅適合新庫或願意清空資料時**執行。**切勿**在已有顧客／訂單資料的 Supabase 上重新套用此 revision。
- **套用遷移**（**必須用 `backend/venv`**，不要用 conda `(base)` 的 `alembic`，在 macOS 上常會 `malloc: double free` 後 abort）：

```bash
cd backend
make migrate
# 或：./venv/bin/alembic upgrade head
```

`make migrate` 僅**執行** repo 內既有的 Alembic revision，不會從 model 自動產生新 migration。若要產生新 revision：`make migration-new MSG="describe change"`。

- 目前 head revision **`b3c4d5e6f7a8`** 補上 `store.owner_email`、`owner_auth_user_id` 可為 NULL、以及 `uq_store_owner_email`／`uq_store_owner_auth_user_id`（支援 `auth.py` 首次登入綁定）。若 Supabase 已手動具備這些欄位，此 migration 為 idempotent（略過已存在項目）。
- Docker 啟動時預設 `**SKIP_ALEMBIC_ON_START=1**`（不自動跑 Alembic）。拉取含新 migration 的程式後，請在 Supabase 上手動執行一次 `make migrate`。

### 多店家 LINE（`store.slug` = webhook `destination`）

每個 Official Account 對應一筆 `store`：

| 欄位 | 說明 |
|------|------|
| `slug` | 與 LINE webhook JSON 的 **`destination`** 相同（channel user id，如 `U4b…`） |
| `line_channel_access_token` | 該店 Messaging API token |
| `line_channel_secret` | Webhook 簽章用 secret |

所有 channel 的 Webhook URL 可相同：`https://<PUBLIC_BASE_URL>/callback`。後端依 `destination` 查 `store.slug` 決定店家與 token。

遷移鏈：`f1a2b3c4d5e6` 新增 LINE 欄位；`b3c4d5e6f7a8` 新增店主 auth 欄位（`owner_email`、nullable `owner_auth_user_id`）。

後台 API（聊天室、訂單、付款方式等）僅回傳**登入店主**所綁定 `store` 的資料（`get_current_store`）。

開發／測試前資料庫**至少要有一筆 `store`**。若 webhook 的 `destination` 尚無對應 `slug`，且 `.env` 仍有 `LINE_CHANNEL_SECRET`，會暫時 fallback 到 `id` 最小的 store（方便遷移前測試）。

### 自動建立／更新店家（JSON → Supabase）

不必手動寫 SQL 或自己查 `destination`：腳本會用你提供的 **Channel access token** 呼叫 LINE `GET /v2/bot/info`，把回傳的 **`userId`** 寫入 `store.slug`（與 webhook `destination` 相同）。

#### 1. 準備 JSON（勿 commit 含 secret 的檔案）

```bash
cd backend
cp config/stores.provision.example.json config/stores.provision.json
```

編輯 [`backend/config/stores.provision.json`](backend/config/stores.provision.json)（此檔已 gitignore）：

```json
{
  "stores": [
    {
      "name": "奇美花店",
      "owner_email": "owner@gmail.com",
      "line_channel_access_token": "貼上 Messaging API Channel access token",
      "line_channel_secret": "貼上 Channel secret",
      "timezone": "Asia/Taipei",
      "active": true
    }
  ]
}
```

| 欄位 | 必填 | 說明 |
|------|------|------|
| `name` | 是 | 店名 |
| `owner_email` | 是 | 店主 Gmail（小寫）；**首次用此帳號登入後台**時會自動綁定該 store |
| `line_channel_access_token` | 是 | 用來寫入 DB，並向 LINE 查 bot `userId` → `slug` |
| `line_channel_secret` | 是 | Webhook 簽章驗證 |
| `slug` | 否 | 可省略；若填了必須與 token 查到的 `userId` 一致 |
| `timezone` / `active` | 否 | 預設 `Asia/Taipei` / `true` |

多家店：在 `"stores"` 陣列再加一個物件即可。

#### 2. 確認 `backend/.env` 的 `DATABASE_URL` 指向目標 Supabase

#### 3. 執行指令（請用 `backend/venv`）

先確認 schema 已 migrate：

```bash
cd backend
make migrate
```

**試跑**（只查 LINE、不寫入資料庫）：

```bash
PYTHONPATH=. ./venv/bin/python scripts/provision_stores.py \
  --file config/stores.provision.json \
  --dry-run
```

**寫入 Supabase**：

```bash
make provision-stores
```

或：

```bash
PYTHONPATH=. ./venv/bin/python scripts/provision_stores.py \
  --file config/stores.provision.json
```

#### 4. 腳本實際會做什麼

對 JSON 裡每一筆 store：

1. 用 `line_channel_access_token` 呼叫 LINE → 取得 `userId` 當 `slug`
2. 以 `owner_email`（或既有 `slug`）在 `store` 表 **新增或更新** 一列
3. 寫入 `line_channel_access_token`、`line_channel_secret`、`name` 等
4. **不會**建立 Supabase Auth 帳號；`owner_auth_user_id` 仍為空，直到店主用 `owner_email` 登入一次

終端機會印出例如：`created store id=2 slug=Uabc...` 或 `updated store id=1`。

#### 5. 之後

- LINE Developers：各 channel 的 Webhook URL 設為 `https://<PUBLIC_BASE_URL>/callback`（可相同）
- 店主用 **`owner_email`** 的 Google 登入後台 → 只看自己店的聊天與訂單

選用：更新 token 後再跑一次 `make provision-stores`；若要強制店主重新綁定，加上 `--reset-owner-binding`（會清掉 `owner_auth_user_id`）。

#### 6. 更換店主 Gmail

每家店僅允許 **一個** Google 帳號登入後台（`owner_email` ↔ `owner_auth_user_id` 1:1）。若要改為另一個 Gmail 管理同一個 LINE 官方帳號，依是否已有人登入過而定：

**尚未有人登入**（`owner_auth_user_id` 仍為空）：

1. 編輯 [`backend/config/stores.provision.json`](backend/config/stores.provision.json)，將 `owner_email` 改為新 Gmail
2. 執行 `make provision-stores`
3. 新 Gmail 首次登入後台即可自動綁定該店

**已有人登入過**（store 已綁定舊 Google 帳號）：

1. 將 `owner_email` 改為新 Gmail
2. 執行 provision 並加上 `--reset-owner-binding`，以清除舊帳號綁定：

```bash
cd backend
PYTHONPATH=. ./venv/bin/python scripts/provision_stores.py \
  --file config/stores.provision.json \
  --reset-owner-binding
```

3. 新 Gmail 登入後台一次，完成重新綁定
4. 舊 Gmail 將無法再存取該店

注意事項：

| 項目 | 說明 |
|------|------|
| LINE Bot 不受影響 | 顧客對話、訂單資料不變；僅後台登入帳號改變 |
| 新 Gmail 須唯一 | 每個 `owner_email` 只能對應一家店（`uq_store_owner_email`） |
| 未加 `--reset-owner-binding` | 只改 `owner_email` **不會**撤銷舊帳號；舊 Google 仍可依 `owner_auth_user_id` 登入 |
| Supabase | 不需手動建立新 Gmail 的 Auth 帳號；首次 Google 登入時自動處理 |

手動 SQL 仍可用：[`backend/docs/manual_migration_f1a2b3c4d5e6.sql`](backend/docs/manual_migration_f1a2b3c4d5e6.sql)。

### 測試資料

```bash
cd backend
PYTHONPATH=. python app/seeds/seed_all.py
```

或後端啟動後：`GET http://localhost:8000/generate-fake-data?count=10`（需 DB 內已有 store）。

### 舊版本機 Docker Postgres

若仍要連過去 compose 裡的 `db` 容器，請在 `.env` 取消註解 `POSTGRES_*` 並自行調整 `docker-compose`；**目前預設流程以 Supabase 為準**，根目錄 `docker-compose.yml` 已不含 `db` 服務。

### 每店訂單欄位設定（`store_order_field_config`）

每家店在 `store_order_field_config` 表有一列（`store_id` unique）。顯示與拖曳順序主要存在 JSON 欄位 **`display_config`**：

```json
{
  "visible_fields": ["id", "customer_name", "item", "quantity", "..."],
  "field_order": ["customer_name", "item", "id", "quantity", "..."]
}
```

| 鍵 | 說明 |
|----|------|
| `visible_fields` | 後台列表／草稿／CSV 要顯示的 catalog key（固定欄位永遠在內） |
| `field_order` | **完整** catalog 的顯示順序（含隱藏欄位）；設定頁拖曳只更新此順序 |

舊欄位 `visible_fields`（JSON 陣列）仍會 dual-write，方便 rollback。Catalog 的 key／中文 label 定義在後端 `app/domain/order_fields.py` 與前端 `frontend/src/config/orderDisplayFields.ts`，須保持同步（測試：`test_order_fields_catalog_alignment.py`）。

---

## 後台 API 與欄位設定（OAuth 單店）

### 目前店家（Staff Dashboard）

登入後，後端以 **`get_current_store`** 將 Supabase JWT 解析為店主綁定的唯一 `store`（1:1）。前端 Navbar 顯示店名（`GET /stores/me`），**不需**手動選店或帶 `X-Store-Id`。

| 端點 | 說明 |
|------|------|
| `GET /stores/me` | 登入店主綁定的店家（需 Bearer JWT） |
| `GET /stores` | 全部 active 店列表（管理／開發用，前端不再使用） |
| `GET /orders` | 僅綁定店訂單 |
| `GET /chat_rooms` | 僅綁定店聊天室 |
| `GET /stats` | 僅綁定店統計 |
| `GET/PUT /store/order-field-config/default` | 綁定店的欄位顯示設定（前端使用） |

帳號未綁定店時回 **403**；JWT 無效或過期回 **401**。

舊多店設計的 `X-Store-Id` header 與 `GET/PUT /stores/{store_id}/order-field-config` 仍保留於後端，但前端已改為 OAuth 單店模式。

### DOCX 工單

`GET /orders/{order_id}.docx` 依訂單所屬 `chat_room.store_id` 讀欄位設定；預設模板為 `backend/docs/工單模板.docx`（可用環境變數 `DOCX_TEMPLATE_FILE` 覆寫）。占位符使用 catalog key（例如 `{{ customer_name }}`、`{{ item }}`），隱藏欄位填空字串。若自行編輯 Word 模板，請用 docxtpl 語法 `{{ 變數名 }}`，變數名須與 catalog key 一致。

### 安全說明

後台 API 需 Supabase Auth JWT；`get_current_store` 將 `owner_auth_user_id` 與登入帳號綁定，僅能存取自己的店。首次登入時以 Gmail 認領 `owner_email` 相符且尚未綁定的 store。LINE Bot 新顧客仍使用 `get_first_store_id()` 掛到最小 `id` 的 store，與後台無關。

### 相關測試

```bash
# 後端（在 backend、venv 已啟用）
pytest tests/test_store_context.py tests/test_store_scoped_api.py \
  tests/test_orders_repository_store_scope.py tests/test_multi_store_docx_and_config.py \
  tests/test_order_field_config_service.py tests/test_order_fields_catalog_alignment.py

# 前端
cd frontend && npm run test
```

---

## 🚀 執行應用程式

### 模式 A：本機跑前後端（連 Supabase）

1. 確認 `backend/.env` 的 `DATABASE_URL` / `DATABASE_ALEM_URL` 正確，且 Supabase 上 schema 與 Alembic head 一致。
2. 後端（**工作目錄必須是 `backend`**）：

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

1. 前端：

```bash
cd frontend
npm run dev
```

1. 網址：
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

將 LINE Webhook 指到 `https://<ngrok-id>.ngrok.io/callback`（各 channel 可用同一 URL），並把 `PUBLIC_BASE_URL` 改成對應的 https 基底（圖片 URL 用）。記得把 webhook 的 `destination` 寫入該店的 `store.slug`。

---

## 🔗 Webhook 配置

於 [LINE Developers Console](https://developers.line.biz/console/) 設定 Webhook URL，例如：

```text
https://your-domain.example.com/callback
```

本機除錯請配合 ngrok。

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


| 目錄              | 說明                                          |
| --------------- | ------------------------------------------- |
| `main.py`       | 應用入口、CORS、靜態 uploads                        |
| `api/v1/`       | API 路由聚合                                    |
| `models/`       | ORM：`Store`、`Customer`、`ChatRoom`、`Order` 等 |
| `routes/`       | HTTP 路由（linebot、orders、chat、payment…）       |
| `services/`     | 業務邏輯                                        |
| `repositories/` | 資料存取（含 `get_first_store_id`）                |
| `schemas/`      | Pydantic 請求／回應；`User` 為 `Customer` 的相容別名    |
| `core/`         | 設定、DB session                               |
| `seeds/`        | 假資料產生                                       |


### `frontend/`（React + TypeScript）

- Vite、TanStack Query、React Router（`/`、`/orders`、`/messages`、`/stats`、`/settings/order-fields`）
- `frontend/.env`：`VITE_API_BASE_URL`（預設 `http://localhost:8000`）
- `StoreContext` + Navbar 顯示綁定店名（`GET /stores/me`）；欄位設定 per-store：`order-display-config:{storeId}`

### 重構後手動 smoke

- 登入後 Navbar 顯示正確店名；Network 中 `/orders`、`/chat_rooms`、`/stats`、`/store/order-field-config/default` 皆 200。
- 首頁訂單表與統計可載入；刪除訂單後列表刷新。
- `Messages`：切換聊天室、送訊、右側草稿面板、「建立新訂單」。
- DOCX 下載、CSV 瀏覽器下載。
- `docker compose up` 下 5173 / 8000 行為與本機模式一致。

---

## 📄 授權

[MIT License](LICENSE)